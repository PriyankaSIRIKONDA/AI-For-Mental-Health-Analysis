import json
from typing import List, Dict, Any, Optional
from .config import settings
import requests

class TwitterService:
    def __init__(self):
        # Service for tweet fetching using Masa API
        self.masa_api_token = settings.masa_api_token
    

    
    def search_tweets(self, query: str, max_results: int = 10) -> List[Dict[str, Any]]:
        """Search for tweets using Masa API"""
        try:
            print(f"🔍 Masa API searching for: '{query}' (max: {max_results})")
            
            # Use Masa API
            masa_results = self._search_tweets_masa_api(query, max_results)
            if masa_results:
                print(f"✅ Masa API found {len(masa_results)} tweets for '{query}'")
                return masa_results
            else:
                raise Exception("No tweets found via Masa API")

        except Exception as e:
            error_msg = str(e)
            print(f"❌ Masa API search failed: {error_msg}")
            raise Exception(f"Failed to search tweets: {error_msg}")
    
    def get_user_tweets(self, username: str, max_results: int = 10) -> List[Dict[str, Any]]:
        """Get tweets from a specific user using Masa API"""
        try:
            print(f"🔍 Masa API searching for tweets from @{username} (max: {max_results})")
            
            # Use Masa API to search for user tweets
            query = f"from:{username}"
            masa_results = self._search_tweets_masa_api(query, max_results)
            if masa_results:
                print(f"✅ Masa API found {len(masa_results)} tweets from @{username}")
                return masa_results
            else:
                raise Exception(f"No tweets found for @{username} via Masa API")

        except Exception as e:
            error_msg = str(e)
            print(f"❌ Masa API user tweets failed: {error_msg}")
            raise Exception(f"Failed to get user tweets: {error_msg}")

    def _search_tweets_masa_api(self, query: str, max_results: int = 10) -> List[Dict[str, Any]]:
        """Search tweets using Masa API"""
        try:
            print(f"🔍 Masa API searching for: '{query}' (max: {max_results})")
            
            # Masa API endpoint and token
            url = "https://data.masa.ai/api/v1/search/live/twitter"
            headers = {
                "Authorization": f"Bearer {self.masa_api_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "type": "twitter-scraper",
                "arguments": {
                    "type": "searchbyquery",
                    "query": query,
                    "max_results": max_results
                }
            }
            
            # Submit the search job
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if we got a UUID (job submitted successfully)
                if 'uuid' in data:
                    job_uuid = data['uuid']
                    print(f"📋 Masa API job submitted with UUID: {job_uuid}")
                    
                    # Poll for results (max 30 seconds)
                    max_attempts = 50
                    for attempt in range(max_attempts):
                        try:
                            # Wait 1 second between attempts
                            import time
                            time.sleep(1)
                            
                            # Check job status
                            result_url = f"https://data.masa.ai/api/v1/search/live/twitter/result/{job_uuid}"
                            result_response = requests.get(result_url, headers=headers, timeout=10)
                            
                            if result_response.status_code == 200:
                                result_data = result_response.json()
                                
                                # Check if we have results
                                if isinstance(result_data, list) and len(result_data) > 0:
                                    print(f"✅ Masa API job completed, found {len(result_data)} tweets")
                                    
                                    results = []
                                    for tweet in result_data[:max_results]:
                                        # Transform Masa API response to match our format
                                        metadata = tweet.get('metadata', {})
                                        public_metrics = metadata.get('public_metrics', {})
                                        
                                        tweet_data = {
                                            'id': str(tweet.get('id', 'unknown')),
                                            'text': tweet.get('content', ''),
                                            'created_at': metadata.get('created_at'),
                                            'author': {
                                                'id': str(metadata.get('user_id', 'unknown')),
                                                'username': metadata.get('username', 'unknown'),
                                                'name': metadata.get('author', 'Unknown User'),
                                                'profile_image_url': None,
                                                'public_metrics': {
                                                    'followers_count': 0,
                                                    'following_count': 0,
                                                    'tweet_count': 0,
                                                    'listed_count': 0
                                                }
                                            },
                                            'public_metrics': {
                                                'like_count': public_metrics.get('LikeCount', 0),
                                                'retweet_count': public_metrics.get('RetweetCount', 0),
                                                'reply_count': public_metrics.get('ReplyCount', 0),
                                                'quote_count': public_metrics.get('QuoteCount', 0)
                                            },
                                            'context_annotations': [],
                                            'source': 'masa_api'  # Mark as Masa API data
                                        }
                                        results.append(tweet_data)
                                    
                                    print(f"✅ Masa API processed {len(results)} tweets for '{query}'")
                                    return results
                                else:
                                    print(f"⏳ Masa API job still processing... (attempt {attempt + 1}/{max_attempts})")
                            else:
                                print(f"⚠️ Masa API status check failed: {result_response.status_code}")
                                
                        except Exception as poll_error:
                            print(f"⚠️ Masa API polling error: {str(poll_error)}")
                    
                    print(f"⏰ Masa API job timed out after {max_attempts} seconds")
                    return []
                
                # Direct results (if any)
                tweets = data if isinstance(data, list) else []
                
                results = []
                for tweet in tweets[:max_results]:
                    # Transform Masa API response to match our format
                    metadata = tweet.get('metadata', {})
                    public_metrics = metadata.get('public_metrics', {})
                    
                    tweet_data = {
                        'id': str(tweet.get('id', 'unknown')),
                        'text': tweet.get('content', ''),
                        'created_at': metadata.get('created_at'),
                        'author': {
                            'id': str(metadata.get('user_id', 'unknown')),
                            'username': metadata.get('username', 'unknown'),
                            'name': metadata.get('author', 'Unknown User'),
                            'profile_image_url': None,
                            'public_metrics': {
                                'followers_count': 0,
                                'following_count': 0,
                                'tweet_count': 0,
                                'listed_count': 0
                            }
                        },
                        'public_metrics': {
                            'like_count': public_metrics.get('LikeCount', 0),
                            'retweet_count': public_metrics.get('RetweetCount', 0),
                            'reply_count': public_metrics.get('ReplyCount', 0),
                            'quote_count': public_metrics.get('QuoteCount', 0)
                        },
                        'context_annotations': [],
                        'source': 'masa_api'  # Mark as Masa API data
                    }
                    results.append(tweet_data)
                
                print(f"✅ Masa API found {len(results)} tweets for '{query}'")
                return results
            else:
                error_msg = f"Masa API returned {response.status_code}: {response.text}"
                print(f"❌ Masa API error: {error_msg}")
                raise Exception(error_msg)
                
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Masa API search failed: {error_msg}")
            raise Exception(f"Masa API search failed: {error_msg}")

twitter_service = TwitterService() 