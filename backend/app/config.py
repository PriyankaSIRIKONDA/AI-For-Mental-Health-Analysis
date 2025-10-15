from pydantic_settings import BaseSettings
from typing import Optional
import os
from pathlib import Path

# Get the directory where this config.py file is located
BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    # Database Configuration
    database_url: str = "postgresql://postgres:password@localhost:5432/postgres"
    database_host: str = "localhost"
    database_port: int = 5432
    database_name: str = "postgres"
    database_user: str = "postgres"
    database_password: str = "password"
    
    # Frontend Configuration
    frontend_url: str = "http://localhost:3000"
    
    # FastAPI Configuration
    secret_key: str = "your-secret-key-here-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    
    # Backend Configuration
    backend_host: str = "localhost"
    backend_port: int = 8000
    
    # Masa API Configuration for Tweet Fetching
    masa_api_token: str = "eWhHVdpvkF4XyCaqLcYJM8zzFs80N64YPyHrabg8VWenepY8"
    
    class Config:
        env_file = BASE_DIR / ".env"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields from old configurations

settings = Settings() 