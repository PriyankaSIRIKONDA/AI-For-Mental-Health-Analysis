#!/usr/bin/env python3
"""
Tweet Fetch Platform - Backend Server
Run the FastAPI server with uvicorn
"""

import uvicorn
from app.main import app
from app.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=True,
        log_level="info"
    ) 