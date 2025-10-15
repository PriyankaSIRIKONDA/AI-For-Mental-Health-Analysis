from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class TweetAuthor(BaseModel):
    id: str
    name: str
    username: str
    profile_image_url: Optional[str]
    public_metrics: Optional[Dict[str, Any]]

class Tweet(BaseModel):
    id: str
    text: str
    created_at: Optional[str]
    author: TweetAuthor
    public_metrics: Optional[Dict[str, Any]]
    context_annotations: Optional[List[Dict[str, Any]]]

class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

class TweetSearchRequest(BaseModel):
    query: str
    max_results: Optional[int] = 100
    force_refresh: Optional[bool] = False

class UserTweetsRequest(BaseModel):
    username: str
    max_results: Optional[int] = 100
    force_refresh: Optional[bool] = False

class TweetSearchResponse(BaseModel):
    tweets: List[Tweet]
    total_count: int

class DownloadTweetsRequest(BaseModel):
    tweets: List[Tweet]
    filename: Optional[str] = None

class TweetAnalysisRequest(BaseModel):
    tweet_id: str
    text: str

class TweetAnalysisResponse(BaseModel):
    id: int
    tweet_id: str
    predicted_label: str
    predicted_class_id: int
    confidence: str
    all_probabilities: Dict[str, float]
    analyzed_text: str
    analysis_timestamp: datetime

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None

class AnalysisReportResponse(BaseModel):
    id: int
    report_content: str
    summary: str
    total_analyzed_tweets: int
    classification_breakdown: Dict[str, int]
    generated_at: datetime
    user_id: int

class AnalysisReportRequest(BaseModel):
    user_id: int

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: Optional[datetime] = None

class CounselorChatRequest(BaseModel):
    report_id: int
    messages: List[ChatMessage]

class CounselorChatResponse(BaseModel):
    message: str

# Voice-related models
class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = "21m00Tcm4TlvDq8ikWAM"  # Default voice (Rachel)

class TTSResponse(BaseModel):
    audio_url: str
    audio_base64: str

class STTRequest(BaseModel):
    audio_base64: str

class STTResponse(BaseModel):
    transcript: str 