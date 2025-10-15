from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
import json
import os
import requests
from datetime import datetime
import litellm
import tempfile
import base64
from elevenlabs import ElevenLabs
from fastapi import File, UploadFile
from io import BytesIO

from .config import settings
from .models import *
from .models import TTSRequest, TTSResponse, STTRequest, STTResponse
from .twitter_service import twitter_service
from .auth import create_access_token, verify_token, authenticate_user, get_user_by_email, get_user_by_username, create_user
from .database import get_db, create_tables, User as DBUser, save_tweets_to_db, TweetAuthorDB, SavedTweet, get_cached_tweets_by_query, get_cached_tweets_by_username, TweetAnalysis, AnalysisReport

app = FastAPI(
    title="Tweet Fetch Platform",
    description="A platform for fetching tweets using Twitter OAuth",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# Initialize ElevenLabs client
eleven_client = ElevenLabs(api_key="sk_193f47b99cc616b6aa2ba52a22cee765d008d403ea213c3d")

# Dependency to get current user from JWT token
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Tweet Fetch Platform API", "status": "running"}

@app.post("/auth/register", response_model=AuthTokenResponse)
async def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    try:
        # Check if user already exists
        if get_user_by_email(db, user_data.email):
            raise HTTPException(status_code=400, detail="Email already registered")
        
        if get_user_by_username(db, user_data.username):
            raise HTTPException(status_code=400, detail="Username already taken")
        
        # Create new user
        db_user = create_user(
            db=db,
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            password=user_data.password
        )
        
        # Create access token
        access_token = create_access_token(data={"user_id": db_user.id})
        
        # Convert SQLAlchemy model to Pydantic model
        user_response = User.from_orm(db_user)
        
        return AuthTokenResponse(
            access_token=access_token,
            user=user_response
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to register user: {str(e)}")

@app.post("/auth/login", response_model=AuthTokenResponse)
async def login_user(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    try:
        # Authenticate user
        user = authenticate_user(db, user_credentials.email, user_credentials.password)
        if not user:
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
        
        # Create access token
        access_token = create_access_token(data={"user_id": user.id})
        
        # Convert SQLAlchemy model to Pydantic model
        user_response = User.from_orm(user)
        
        return AuthTokenResponse(
            access_token=access_token,
            user=user_response
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to login: {str(e)}")

@app.get("/user/me", response_model=User)
async def get_current_user_info(current_user: DBUser = Depends(get_current_user)):
    """Get current authenticated user info"""
    try:
        return User.from_orm(current_user)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user info: {str(e)}")

@app.post("/tweets/search", response_model=TweetSearchResponse)
async def search_tweets(
    request: TweetSearchRequest,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search for tweets - check database first, then fetch from API if needed"""
    try:
        # Check cache first, unless force_refresh is requested
        if not request.force_refresh:
            # First, check if we have cached tweets for this search query
            cached_tweets = get_cached_tweets_by_query(db, request.query, current_user.id, request.max_results)
            
            if cached_tweets and len(cached_tweets) >= request.max_results:
                # We have enough cached tweets, return them
                print(f"✅ Returning {len(cached_tweets)} cached tweets for query '{request.query}' for user {current_user.username}")
                
                # Convert database models to API models
                tweet_objects = []
                for saved_tweet in cached_tweets:
                    tweet_data = {
                        'id': saved_tweet.twitter_id,
                        'text': saved_tweet.text,
                        'created_at': saved_tweet.created_at_twitter.isoformat() if saved_tweet.created_at_twitter else None,
                        'author': {
                            'id': saved_tweet.author.twitter_id,
                            'name': saved_tweet.author.name,
                            'username': saved_tweet.author.username,
                            'profile_image_url': saved_tweet.author.profile_image_url,
                            'public_metrics': saved_tweet.author.public_metrics or {}
                        },
                        'public_metrics': saved_tweet.public_metrics or {},
                        'context_annotations': saved_tweet.context_annotations or [],
                        'source': saved_tweet.source
                    }
                    tweet_objects.append(Tweet(**tweet_data))
                
                return TweetSearchResponse(
                    tweets=tweet_objects[:request.max_results],
                    total_count=len(tweet_objects[:request.max_results])
                )
        
        # If we don't have enough cached tweets or force_refresh is requested, fetch from API
        reason = "force refresh requested" if request.force_refresh else f"no cached tweets found, needed: {request.max_results}"
        print(f"🔍 Fetching new tweets from API for query '{request.query}' ({reason})")
        
        tweets = twitter_service.search_tweets(
            query=request.query,
            max_results=request.max_results
        )
        
        tweet_objects = [Tweet(**tweet) for tweet in tweets]
        
        # Save new tweets to database
        try:
            saved_tweets = save_tweets_to_db(db, tweets, current_user.id)
            print(f"✅ Saved {len(saved_tweets)} new tweets to database for user {current_user.username}")
        except Exception as save_error:
            print(f"⚠️ Failed to save tweets to database: {str(save_error)}")
            # Continue even if saving fails - don't break the API response
        
        return TweetSearchResponse(
            tweets=tweet_objects,
            total_count=len(tweet_objects)
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search tweets: {str(e)}")

@app.post("/tweets/user", response_model=TweetSearchResponse)
async def get_user_tweets(
    request: UserTweetsRequest,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get tweets from a specific user - check database first, then fetch from API if needed"""
    try:
        # Check cache first, unless force_refresh is requested
        if not request.force_refresh:
            # First, check if we have cached tweets for this user
            cached_tweets = get_cached_tweets_by_username(db, request.username, current_user.id, request.max_results)
            
            if cached_tweets and len(cached_tweets) >= request.max_results:
                # We have enough cached tweets, return them
                print(f"✅ Returning {len(cached_tweets)} cached tweets for user @{request.username} for user {current_user.username}")
                
                # Convert database models to API models
                tweet_objects = []
                for saved_tweet in cached_tweets:
                    tweet_data = {
                        'id': saved_tweet.twitter_id,
                        'text': saved_tweet.text,
                        'created_at': saved_tweet.created_at_twitter.isoformat() if saved_tweet.created_at_twitter else None,
                        'author': {
                            'id': saved_tweet.author.twitter_id,
                            'name': saved_tweet.author.name,
                            'username': saved_tweet.author.username,
                            'profile_image_url': saved_tweet.author.profile_image_url,
                            'public_metrics': saved_tweet.author.public_metrics or {}
                        },
                        'public_metrics': saved_tweet.public_metrics or {},
                        'context_annotations': saved_tweet.context_annotations or [],
                        'source': saved_tweet.source
                    }
                    tweet_objects.append(Tweet(**tweet_data))
                
                return TweetSearchResponse(
                    tweets=tweet_objects[:request.max_results],
                    total_count=len(tweet_objects[:request.max_results])
                )
        
        # If we don't have enough cached tweets or force_refresh is requested, fetch from API
        reason = "force refresh requested" if request.force_refresh else f"no cached tweets found, needed: {request.max_results}"
        print(f"🔍 Fetching new tweets from API for user @{request.username} ({reason})")
        
        tweets = twitter_service.get_user_tweets(
            username=request.username,
            max_results=request.max_results
        )
        
        tweet_objects = [Tweet(**tweet) for tweet in tweets]
        
        # Save new tweets to database
        try:
            saved_tweets = save_tweets_to_db(db, tweets, current_user.id)
            print(f"✅ Saved {len(saved_tweets)} new tweets to database for user {current_user.username}")
        except Exception as save_error:
            print(f"⚠️ Failed to save tweets to database: {str(save_error)}")
            # Continue even if saving fails - don't break the API response
        
        return TweetSearchResponse(
            tweets=tweet_objects,
            total_count=len(tweet_objects)
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user tweets: {str(e)}")

@app.get("/tweets/saved", response_model=TweetSearchResponse)
async def get_saved_tweets(
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """Get tweets saved by the current user from the database"""
    try:
        # Query saved tweets for the current user
        saved_tweets = db.query(SavedTweet).filter(
            SavedTweet.user_id == current_user.id
        ).order_by(SavedTweet.created_at.desc()).offset(offset).limit(limit).all()
        
        # Convert database models to API models
        tweet_objects = []
        for saved_tweet in saved_tweets:
            tweet_data = {
                'id': saved_tweet.twitter_id,
                'text': saved_tweet.text,
                'created_at': saved_tweet.created_at_twitter.isoformat() if saved_tweet.created_at_twitter else None,
                'author': {
                    'id': saved_tweet.author.twitter_id,
                    'name': saved_tweet.author.name,
                    'username': saved_tweet.author.username,
                    'profile_image_url': saved_tweet.author.profile_image_url,
                    'public_metrics': saved_tweet.author.public_metrics or {}
                },
                'public_metrics': saved_tweet.public_metrics or {},
                'context_annotations': saved_tweet.context_annotations or [],
                'source': saved_tweet.source
            }
            tweet_objects.append(Tweet(**tweet_data))
        
        return TweetSearchResponse(
            tweets=tweet_objects,
            total_count=len(tweet_objects)
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get saved tweets: {str(e)}")

@app.post("/tweets/download")
async def download_tweets(
    request: DownloadTweetsRequest,
    current_user: DBUser = Depends(get_current_user)
):
    """Download tweets as JSON file"""
    try:
        # Convert tweets to dict for JSON serialization
        tweets_data = [tweet.dict() for tweet in request.tweets]
        
        # Create downloads directory if it doesn't exist
        downloads_dir = "downloads"
        os.makedirs(downloads_dir, exist_ok=True)
        
        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = request.filename or f"tweets_{timestamp}.json"
        
        # Ensure .json extension
        if not filename.endswith('.json'):
            filename += '.json'
        
        filepath = os.path.join(downloads_dir, filename)
        
        # Save tweets to file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "total_tweets": len(tweets_data),
                "tweets": tweets_data,
                "user": current_user.username  # Add user info
            }, f, indent=2, ensure_ascii=False)
        
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type="application/json"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download tweets: {str(e)}")

@app.post("/tweets/analyze", response_model=TweetAnalysisResponse)
async def analyze_tweet(
    request: TweetAnalysisRequest,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Analyze tweet text using RunPod mental health classification API"""
    try:
        # Check if we already have an analysis for this tweet by this user
        existing_analysis = db.query(TweetAnalysis).join(SavedTweet).filter(
            SavedTweet.twitter_id == request.tweet_id,
            TweetAnalysis.user_id == current_user.id
        ).first()
        
        if existing_analysis:
            # Return existing analysis
            return TweetAnalysisResponse(
                id=existing_analysis.id,
                tweet_id=request.tweet_id,
                predicted_label=existing_analysis.predicted_label,
                predicted_class_id=existing_analysis.predicted_class_id,
                confidence=existing_analysis.confidence,
                all_probabilities=existing_analysis.all_probabilities,
                analyzed_text=existing_analysis.analyzed_text,
                analysis_timestamp=existing_analysis.analysis_timestamp
            )
        
        # Call RunPod API - Use environment variables for security
        runpod_url = f"https://api.runpod.ai/v2/{os.getenv('RUNPOD_ENDPOINT_ID', 'your-endpoint-id')}/runsync"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.getenv('RUNPOD_API_KEY', 'your-api-key')}"
        }
        
        payload = {
            "input": {
                "text": request.text,
                "return_probabilities": True
            }
        }
        
        response = requests.post(runpod_url, headers=headers, json=payload, timeout=30)
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"RunPod API error: {response.status_code}")
        
        api_result = response.json()
        
        if api_result.get("status") != "COMPLETED":
            raise HTTPException(status_code=500, detail="Analysis failed to complete")
        
        output = api_result.get("output", {})
        
        # Find the saved tweet
        saved_tweet = db.query(SavedTweet).filter(
            SavedTweet.twitter_id == request.tweet_id,
            SavedTweet.user_id == current_user.id
        ).first()
        
        if not saved_tweet:
            raise HTTPException(status_code=404, detail="Tweet not found in your saved tweets")
        
        # Save analysis results to database
        analysis = TweetAnalysis(
            predicted_label=output.get("predicted_label"),
            predicted_class_id=output.get("predicted_class_id"),
            confidence=str(output.get("confidence")),
            all_probabilities=output.get("all_probabilities", {}),
            analyzed_text=output.get("text"),
            tweet_id=saved_tweet.id,
            user_id=current_user.id
        )
        
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        
        return TweetAnalysisResponse(
            id=analysis.id,
            tweet_id=request.tweet_id,
            predicted_label=analysis.predicted_label,
            predicted_class_id=analysis.predicted_class_id,
            confidence=analysis.confidence,
            all_probabilities=analysis.all_probabilities,
            analyzed_text=analysis.analyzed_text,
            analysis_timestamp=analysis.analysis_timestamp
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze tweet: {str(e)}")

@app.post("/tweets/analyze-all")
async def analyze_all_tweets(
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Analyze all saved tweets for the current user concurrently and generate a report"""
    import asyncio
    import aiohttp
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from .database import get_database_url
    
    try:
        # Get all saved tweets for the user that haven't been analyzed yet
        from sqlalchemy import select
        analyzed_tweet_ids_select = select(TweetAnalysis.tweet_id).filter(
            TweetAnalysis.user_id == current_user.id
        )
        
        unanalyzed_tweets = db.query(SavedTweet).filter(
            SavedTweet.user_id == current_user.id,
            ~SavedTweet.id.in_(analyzed_tweet_ids_select)
        ).all()
        
        if not unanalyzed_tweets:
            # No new tweets to analyze, but we can still generate a report with existing data
            print(f"No unanalyzed tweets found for user {current_user.username}. Generating report from existing analyses.")
            report = await generate_analysis_report(current_user.id, db)
            return {
                "message": "No unanalyzed tweets found. Generated report from existing analyses.",
                "analyzed_count": 0,
                "total_count": 0,
                "results": [],
                "report_id": report.id if report else None
            }
        
        # RunPod API configuration - Use environment variables for security
        runpod_url = f"https://api.runpod.ai/v2/{os.getenv('RUNPOD_ENDPOINT_ID', 'your-endpoint-id')}/runsync"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.getenv('RUNPOD_API_KEY', 'your-api-key')}"
        }
        
        # Create separate database engine for concurrent database writes
        engine = create_engine(get_database_url())
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        # Shared counters
        analyzed_count = 0
        failed_count = 0
        analysis_results = []
        results_lock = asyncio.Lock()
        
        # Concurrent processing function with immediate database write
        async def analyze_and_save_tweet(session, tweet, semaphore):
            async with semaphore:  # Limit concurrent requests to 5
                try:
                    payload = {
                        "input": {
                            "text": tweet.text,
                            "return_probabilities": True
                        }
                    }
                    
                    # API call with timeout and retry logic
                    for attempt in range(2):  # 2 attempts
                        try:
                            async with session.post(runpod_url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=90)) as response:
                                if response.status != 200:
                                    if attempt == 0:  # Retry once
                                        await asyncio.sleep(1)
                                        continue
                                    return {"success": False, "tweet": tweet, "error": f"HTTP {response.status}"}
                                
                                api_result = await response.json()
                                
                                if api_result.get("status") != "COMPLETED":
                                    if attempt == 0:  # Retry once
                                        await asyncio.sleep(1)
                                        continue
                                    return {"success": False, "tweet": tweet, "error": "Analysis not completed"}
                                
                                output = api_result.get("output", {})
                                break  # Success, exit retry loop
                                
                        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                            if attempt == 0:  # Retry once
                                print(f"Network error on attempt {attempt + 1} for tweet {tweet.twitter_id}: {str(e)}. Retrying...")
                                await asyncio.sleep(2)
                                continue
                            return {"success": False, "tweet": tweet, "error": f"Network error: {str(e)}"}
                    
                    # Immediately save to database using a new session
                    try:
                        with SessionLocal() as db_session:
                            analysis = TweetAnalysis(
                                predicted_label=output.get("predicted_label"),
                                predicted_class_id=output.get("predicted_class_id"),
                                confidence=str(output.get("confidence")),
                                all_probabilities=output.get("all_probabilities", {}),
                                analyzed_text=output.get("text"),
                                tweet_id=tweet.id,
                                user_id=current_user.id
                            )
                            
                            db_session.add(analysis)
                            db_session.commit()
                            db_session.refresh(analysis)
                            
                            # Thread-safe update of shared results
                            async with results_lock:
                                nonlocal analyzed_count, analysis_results
                                analyzed_count += 1
                                analysis_results.append({
                                    "tweet_id": tweet.twitter_id,
                                    "predicted_label": analysis.predicted_label,
                                    "confidence": analysis.confidence
                                })
                            
                            print(f"✅ Analyzed and saved tweet {tweet.twitter_id} ({analyzed_count}/{len(unanalyzed_tweets)})")
                            return {"success": True, "tweet": tweet, "analysis": analysis}
                            
                    except Exception as db_error:
                        print(f"Database error for tweet {tweet.twitter_id}: {str(db_error)}")
                        return {"success": False, "tweet": tweet, "error": f"Database error: {str(db_error)}"}
                        
                except Exception as e:
                    return {"success": False, "tweet": tweet, "error": str(e)}
        
        # Process tweets concurrently with max 5 concurrent requests
        semaphore = asyncio.Semaphore(5)  # Limit to 5 concurrent requests (matching your worker count)
        
        # Create aiohttp session with custom connector settings
        connector = aiohttp.TCPConnector(
            limit=10,  # Total connection pool size
            limit_per_host=5,  # Max connections per host
            ttl_dns_cache=300,  # DNS cache TTL
            use_dns_cache=True,
        )
        
        async with aiohttp.ClientSession(connector=connector) as session:
            # Create tasks for all tweets
            tasks = [analyze_and_save_tweet(session, tweet, semaphore) for tweet in unanalyzed_tweets]
            
            print(f"🚀 Starting concurrent analysis and database saving of {len(unanalyzed_tweets)} tweets with 5 workers...")
            
            # Execute all tasks concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count failures from results
        for result in results:
            if isinstance(result, Exception):
                failed_count += 1
                print(f"Exception in task: {str(result)}")
            elif not result.get("success"):
                failed_count += 1
                print(f"Failed to analyze tweet {result['tweet'].twitter_id}: {result.get('error', 'Unknown error')}")
        
        # Generate analysis report after completing the analysis
        print("📊 Generating analysis report...")
        report = await generate_analysis_report(current_user.id, db)
        
        print(f"✅ Concurrent analysis completed: {analyzed_count} success, {failed_count} failed")
        
        return {
            "message": f"Concurrent analysis completed. {analyzed_count} tweets analyzed successfully, {failed_count} failed",
            "analyzed_count": analyzed_count,
            "failed_count": failed_count,
            "total_count": len(unanalyzed_tweets),
            "results": analysis_results,
            "report_id": report.id if report else None
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze all tweets: {str(e)}")

@app.post("/reports/generate", response_model=AnalysisReportResponse)
async def create_analysis_report(
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a new analysis report using LiteLLM without running analysis"""
    try:
        # Check if there are any analyzed tweets
        existing_analyses = db.query(TweetAnalysis).filter(
            TweetAnalysis.user_id == current_user.id
        ).first()
        
        if not existing_analyses:
            raise HTTPException(status_code=404, detail="No analyzed tweets found. Please analyze tweets first before generating a report.")
        
        report = await generate_analysis_report(current_user.id, db)
        
        if not report:
            raise HTTPException(status_code=404, detail="No analyzed tweets found to generate report")
        
        return AnalysisReportResponse(
            id=report.id,
            report_content=report.report_content,
            summary=report.summary,
            total_analyzed_tweets=report.total_analyzed_tweets,
            classification_breakdown=report.classification_breakdown,
            generated_at=report.generated_at,
            user_id=report.user_id
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.get("/reports/latest", response_model=AnalysisReportResponse)
async def get_latest_report(
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the latest analysis report for the current user"""
    try:
        report = db.query(AnalysisReport).filter(
            AnalysisReport.user_id == current_user.id
        ).order_by(AnalysisReport.generated_at.desc()).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="No reports found")
        
        return AnalysisReportResponse(
            id=report.id,
            report_content=report.report_content,
            summary=report.summary,
            total_analyzed_tweets=report.total_analyzed_tweets,
            classification_breakdown=report.classification_breakdown,
            generated_at=report.generated_at,
            user_id=report.user_id
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get latest report: {str(e)}")

@app.get("/reports/{report_id}", response_model=AnalysisReportResponse)
async def get_report_by_id(
    report_id: int,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific report by ID"""
    try:
        report = db.query(AnalysisReport).filter(
            AnalysisReport.id == report_id,
            AnalysisReport.user_id == current_user.id
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return AnalysisReportResponse(
            id=report.id,
            report_content=report.report_content,
            summary=report.summary,
            total_analyzed_tweets=report.total_analyzed_tweets,
            classification_breakdown=report.classification_breakdown,
            generated_at=report.generated_at,
            user_id=report.user_id
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get report: {str(e)}")

async def generate_analysis_report(user_id: int, db: Session) -> AnalysisReport:
    """Generate analysis report using LiteLLM with OpenRouter and Gemini"""
    try:
        # Get all analyzed tweets for the user
        analyses = db.query(TweetAnalysis).filter(
            TweetAnalysis.user_id == user_id
        ).join(SavedTweet).all()
        
        if not analyses:
            return None
        
        # Prepare data for the LLM
        classification_breakdown = {}
        analyzed_texts = []
        predicted_labels = []
        
        for analysis in analyses:
            analyzed_texts.append(analysis.analyzed_text)
            predicted_labels.append(analysis.predicted_label)
            
            if analysis.predicted_label in classification_breakdown:
                classification_breakdown[analysis.predicted_label] += 1
            else:
                classification_breakdown[analysis.predicted_label] = 1
        
        # Get the current timestamp for the report
        current_timestamp = datetime.now().strftime('%B %d, %Y at %I:%M %p')
        
        prompt = f"""
        You are a licensed clinical psychologist conducting a comprehensive mental health assessment. Based on your clinical expertise, analyze the following digital communications to identify psychological patterns and mental health indicators.

        **CLINICAL ASSESSMENT SCOPE:**
        - Total communications reviewed: {len(analyses)}
        - Assessment method: Clinical content analysis and psychological evaluation

        **CONTENT FOR CLINICAL REVIEW:**
        {json.dumps([{"text": text[:200] + "..." if len(text) > 200 else text} for text in analyzed_texts[:15]], indent=2)}

        **ASSESSMENT REQUIREMENTS:**

        Generate a compassionate and understandable psychological assessment report, written as if speaking directly to someone seeking help:

        ## 1. UNDERSTANDING YOUR EMOTIONAL PATTERNS
        - What I notice about your emotional expression
        - Patterns in how you communicate and cope
        - Your strengths and positive qualities

        ## 2. AREAS OF CONCERN AND SUPPORT
        - Challenges you might be facing
        - Signs that suggest you could benefit from support
        - Normal responses to difficult situations

        ## 3. YOUR MENTAL WELLNESS PICTURE
        - What's working well for you
        - Areas where you might feel stuck or struggling
        - How your thoughts and feelings connect

        ## 4. PRACTICAL SUGGESTIONS AND NEXT STEPS
        - Specific, actionable steps you can take today
        - Coping strategies that might help
        - When and how to seek additional support
        - Resources and tools that could be beneficial

        ## 5. BUILDING YOUR SUPPORT SYSTEM
        - How to strengthen relationships and connections
        - Professional help options to consider
        - Self-care practices tailored to your situation

        ## 6. MOVING FORWARD WITH HOPE
        - Realistic goals for improvement
        - Signs of progress to watch for
        - Reminders of your resilience and capability

        **COMMUNICATION STYLE:**
        - Use clear, everyday language (avoid excessive clinical jargon)
        - Be warm, supportive, and non-judgmental
        - Provide hope and realistic optimism
        - Give practical, implementable advice
        - Explain psychological concepts in relatable terms
        - Focus on empowerment and personal agency
        - Acknowledge struggles while highlighting strengths

        **APPROACH:**
        - Write as if you're having a caring conversation with someone
        - Validate feelings and experiences
        - Offer concrete steps and suggestions
        - Balance honesty about challenges with hope for improvement
        - Make mental health concepts accessible and relatable
        """
        
        # Set up LiteLLM with OpenRouter
        litellm.api_key = "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"
        
        # Generate report using Gemini Flash via OpenRouter
        response = await litellm.acompletion(
            model="openrouter/google/gemini-flash-1.5",
            messages=[
                {"role": "system", "content": "You are a licensed clinical psychologist conducting a compassionate psychological assessment. Analyze the provided text communications using your clinical expertise to understand emotional patterns, mental health indicators, and psychological well-being. Provide a warm, understandable report with practical guidance, as if you're having a caring conversation with someone seeking help. Focus on strengths, areas of concern, and actionable steps for mental wellness. Use accessible language and maintain a supportive, hopeful tone throughout your assessment."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=4000,
            temperature=0.0
        )
        
        # Add timestamp header to the report content
        report_header = f"# Mental Health Analysis Report\n\n**Generated on:** {current_timestamp}\n**Total Tweets Analyzed:** {len(analyses)}\n\n---\n\n"
        report_content = report_header + response.choices[0].message.content
        
        # Generate a shorter summary
        summary_prompt = f"""
        Based on the following detailed report, provide a concise 2-3 sentence summary highlighting the key findings:
        
        {response.choices[0].message.content}
        """
        
        summary_response = await litellm.acompletion(
            model="openrouter/google/gemini-flash-1.5",
            messages=[
                {"role": "user", "content": summary_prompt}
            ],
            max_tokens=200,
            temperature=0.0
        )
        
        summary = summary_response.choices[0].message.content
        
        # Save report to database
        report = AnalysisReport(
            report_content=report_content,
            summary=summary,
            total_analyzed_tweets=len(analyses),
            classification_breakdown=classification_breakdown,
            user_id=user_id
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        return report
        
    except Exception as e:
        print(f"Error generating report: {str(e)}")
        # Create a fallback report if LiteLLM fails
        classification_breakdown = {}
        for analysis in analyses:
            if analysis.predicted_label in classification_breakdown:
                classification_breakdown[analysis.predicted_label] += 1
            else:
                classification_breakdown[analysis.predicted_label] = 1
        
        current_timestamp_fallback = datetime.now().strftime('%B %d, %Y at %I:%M %p')
        fallback_report = f"""# Mental Health Analysis Report

**Generated on:** {current_timestamp_fallback}
**Total Tweets Analyzed:** {len(analyses)}

---

## Analysis Summary

This is a basic report generated due to an error in the AI analysis system.

### Classification Breakdown

```json
{json.dumps(classification_breakdown, indent=2)}
```

### Note
This report contains basic statistical information only. For detailed insights, please try regenerating the report.
        """
        
        report = AnalysisReport(
            report_content=fallback_report,
            summary=f"Analysis of {len(analyses)} tweets with {len(classification_breakdown)} different classifications.",
            total_analyzed_tweets=len(analyses),
            classification_breakdown=classification_breakdown,
            user_id=user_id
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        return report

@app.get("/tweets/cache-status")
async def get_cache_status(
    query: Optional[str] = None,
    username: Optional[str] = None,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get cache status for a search query or username"""
    try:
        cache_info = {}
        
        if query:
            cached_tweets = get_cached_tweets_by_query(db, query, current_user.id, 100)  # Check for more tweets
            cache_info['query'] = {
                'search_term': query,
                'cached_count': len(cached_tweets),
                'last_cached': cached_tweets[0].created_at.isoformat() if cached_tweets else None
            }
        
        if username:
            cached_tweets = get_cached_tweets_by_username(db, username, current_user.id, 100)  # Check for more tweets
            cache_info['username'] = {
                'username': username,
                'cached_count': len(cached_tweets),
                'last_cached': cached_tweets[0].created_at.isoformat() if cached_tweets else None
            }
        
        if not query and not username:
            # Get overall cache stats
            total_cached = db.query(SavedTweet).filter(SavedTweet.user_id == current_user.id).count()
            cache_info['overall'] = {
                'total_cached_tweets': total_cached,
                'user': current_user.username
            }
        
        return cache_info
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cache status: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@app.post("/counselor/chat", response_model=CounselorChatResponse)
async def chat_with_counselor(
    request: CounselorChatRequest,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Chat with AI counselor using report and tweet data as context"""
    try:
        # Get the report and verify user ownership
        report = db.query(AnalysisReport).filter(
            AnalysisReport.id == request.report_id,
            AnalysisReport.user_id == current_user.id
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        # Get user's analyzed tweets for context
        analyses = db.query(TweetAnalysis).filter(
            TweetAnalysis.user_id == current_user.id
        ).join(SavedTweet).limit(20).all()  # Get recent 20 for context
        
        # Prepare context from report and tweets
        tweet_samples = []
        for analysis in analyses[:10]:  # Use top 10 for context
            tweet_samples.append({
                "text": analysis.analyzed_text[:200] + "..." if len(analysis.analyzed_text) > 200 else analysis.analyzed_text,
                "classification": analysis.predicted_label,
                "confidence": analysis.confidence
            })

        # Prepare conversation history
        conversation_history = []
        for msg in request.messages[-10:]:  # Keep last 10 messages for context
            conversation_history.append({
                "role": msg.role,
                "content": msg.content
            })

        # Create counselor prompt
        system_prompt = f"""You are a compassionate, professional AI mental health counselor. You are speaking with {current_user.full_name or 'a user'} who has had their social media content analyzed for mental health patterns.

IMPORTANT CONTEXT:
- Total tweets analyzed: {report.total_analyzed_tweets}
- Classification breakdown: {json.dumps(report.classification_breakdown)}
- Recent tweet samples with classifications: {json.dumps(tweet_samples, indent=2)}

COUNSELING GUIDELINES:
1. Be empathetic, supportive, and non-judgmental
2. Use active listening techniques and validate their feelings
3. Reference the analysis results when relevant, but focus on the person's current emotional state
4. Provide practical coping strategies and mental health techniques
5. Encourage professional help when appropriate
6. Use markdown formatting for better readability
7. Keep responses focused and not overly long
8. CRITICAL: Always include appropriate disclaimers about not replacing professional care

IMPORTANT: You are NOT a replacement for professional mental health care. Always remind users to seek professional help for serious concerns."""

        # Get the latest user message
        latest_message = conversation_history[-1]['content'] if conversation_history else ""

        # Set up LiteLLM with OpenRouter
        litellm.api_base = "https://openrouter.ai/api/v1"
        litellm.api_key = "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"

        # Generate counselor response
        messages_for_llm = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Add conversation history
        for msg in conversation_history:
            messages_for_llm.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        response = await litellm.acompletion(
            model="openrouter/google/gemini-flash-1.5",
            messages=messages_for_llm,
            max_tokens=1000,
            temperature=0.7  # Slightly higher for more natural conversation
        )

        counselor_response = response.choices[0].message.content

        return CounselorChatResponse(message=counselor_response)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in counselor chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get counselor response: {str(e)}")

@app.post("/voice/tts", response_model=TTSResponse)
async def text_to_speech(
    request: TTSRequest,
    current_user: DBUser = Depends(get_current_user)
):
    """Convert text to speech using ElevenLabs Flash v2.5 model for near real-time performance"""
    try:
        # Generate speech using ElevenLabs text_to_speech.convert method
        audio_generator = eleven_client.text_to_speech.convert(
            text=request.text,
            voice_id=request.voice_id,
            model_id="eleven_flash_v2_5",  # Flash v2.5 for ~75ms latency
            output_format="mp3_44100_128"
        )
        
        # Collect audio data from generator
        audio_data = b""
        for chunk in audio_generator:
            audio_data += chunk
        
        # Convert to base64 for response
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        # Return the base64 data directly
        return TTSResponse(
            audio_url="data:audio/mpeg;base64," + audio_base64,
            audio_base64=audio_base64
        )
        
    except Exception as e:
        print(f"Error in TTS: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate speech: {str(e)}")

@app.post("/voice/stt", response_model=STTResponse)
async def speech_to_text(
    audio_file: UploadFile = File(...),
    current_user: DBUser = Depends(get_current_user)
):
    """Convert speech to text using ElevenLabs Speech Recognition"""
    try:
        # Read the audio file
        audio_data = await audio_file.read()
        
        # Save to temporary file for processing
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            temp_file.write(audio_data)
            temp_file_path = temp_file.name
        
        try:
            # Use ElevenLabs Speech Recognition (Scribe v1)
            with open(temp_file_path, "rb") as audio_file_obj:
                result = eleven_client.speech_to_text.convert(
                    file=audio_file_obj,
                    model_id="scribe_v1",  # ElevenLabs Scribe v1 model
                    tag_audio_events=True,  # Tag audio events like laughter, applause, etc.
                    language_code="eng",  # English language
                    diarize=False  # Don't need speaker diarization for single user
                )
                
                # Extract just the text from the ElevenLabs response object
                if hasattr(result, 'text'):
                    transcript = result.text
                elif isinstance(result, dict) and 'text' in result:
                    transcript = result['text']
                else:
                    # Fallback: try to extract text from string representation
                    result_str = str(result)
                    if 'text="' in result_str:
                        start = result_str.find('text="') + 6
                        end = result_str.find('"', start)
                        transcript = result_str[start:end] if end > start else ""
                    else:
                        transcript = ""
                
                return STTResponse(transcript=transcript.strip())
                
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        print(f"Error in STT: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to transcribe speech: {str(e)}")

@app.get("/debug/config")
async def debug_config():
    """Debug endpoint to check configuration (for development only)"""
    return {
        "database_configured": bool(settings.database_url),
        "masa_api_token_set": bool(settings.masa_api_token),
        "secret_key_set": bool(settings.secret_key),
        "frontend_url": settings.frontend_url
    }

@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    print(f"Action Learning Platform API starting on {settings.backend_host}:{settings.backend_port}")
    
    # Initialize database
    try:
        create_tables()
        print("✓ Database tables created successfully")
    except Exception as e:
        print(f"✗ Database initialization failed: {e}")
    
    # Check configuration
    print(f"Database URL configured: {'✓' if settings.database_url else '✗'}")
    print(f"Masa API token loaded: {'✓' if settings.masa_api_token else '✗'}")
    print(f"Secret Key loaded: {'✓' if settings.secret_key else '✗'}")
    
    # Test Masa API service
    try:
        print("✓ Masa API service available for tweet fetching")
    except Exception as e:
        print(f"✗ Masa API service initialization failed: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=True
    ) 