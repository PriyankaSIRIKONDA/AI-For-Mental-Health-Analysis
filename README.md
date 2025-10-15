# Action Learning Platform

A web platform for fetching and analyzing tweets for learning and research purposes. Built with FastAPI backend and React frontend, featuring user authentication, tweet data retrieval via Masa API, and persistent tweet storage.

## Features

- **User Authentication**: Register and login with email/password using JWT tokens
- **Tweet Fetching**: Search for tweets by query or username via Masa API
- **Tweet Storage**: Automatically save fetched tweets to PostgreSQL database
- **Tweet History**: View previously fetched tweets from your personal collection
- **Real-time Data**: Access up-to-date tweet data via Masa API
- **Secure**: PostgreSQL database with password hashing and JWT authentication
- **Modern UI**: React 18 with Tailwind CSS, HeadlessUI components, and toast notifications

## Architecture

### Backend
- **FastAPI**: Modern Python web framework with automatic API documentation
- **PostgreSQL**: Relational database for user management and tweet storage
- **SQLAlchemy**: Database ORM with relationship management
- **JWT Authentication**: Secure token-based authentication (24-hour expiry)
- **Masa API Integration**: For real-time tweet data retrieval
- **Tweet Persistence**: Automatic saving of fetched tweets with author information

### Frontend
- **React 18**: Modern JavaScript framework with hooks and context
- **Tailwind CSS**: Utility-first CSS framework for styling
- **HeadlessUI**: Unstyled, accessible UI components
- **React Router**: Client-side routing with protected routes
- **Axios**: HTTP client for API requests
- **React Hot Toast**: Modern toast notifications
- **Lucide React**: Beautiful SVG icons

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 18+
- PostgreSQL 12+

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Action_Learning_Platform
   ```

2. **Database Setup**:
   ```bash
   # Install and start PostgreSQL (example for macOS)
   brew install postgresql
   brew services start postgresql
   
   # Create database
   createdb postgres
   ```

3. **Backend Setup**:
   ```bash
   cd backend
   pip install -r requirements.txt
   
   # Create .env file with your configuration
   cat > .env << EOF
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=password
SECRET_KEY=your-secret-key-here-change-in-production
FRONTEND_URL=http://localhost:3000
BACKEND_HOST=localhost
BACKEND_PORT=8000
MASA_API_TOKEN=eWhHVdpvkF4XyCaqLcYJM8zzFs80N64YPyHrabg8VWenepY8
EOF
   
   # Start backend server
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm start
   ```

5. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## Usage

### 1. Registration/Login

1. Visit http://localhost:3000
2. Click "Register" to create a new account with email, twitter username, full name, and password
3. Or login with existing credentials
4. JWT tokens are automatically managed for 24-hour sessions





#### Get User Tweets


## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user and receive JWT token
- `GET /user/me` - Get current authenticated user info

### Tweet Operations
- `POST /tweets/search` - Search tweets by query (auto-saves to database)
- `POST /tweets/user` - Get tweets from specific user (auto-saves to database)
- `GET /tweets/saved` - Retrieve saved tweets from personal collection
- `POST /tweets/download` - Download tweets as JSON file

### Utility
- `GET /` - Health check endpoint
- `GET /health` - Detailed health check with timestamp
- `GET /debug/config` - Configuration status (development only)
- `GET /docs` - Interactive API documentation (Swagger UI)

## Configuration

### Environment Variables

Create `backend/.env` with:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/action_learning_platform
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=action_learning_platform
DATABASE_USER=user
DATABASE_PASSWORD=password

# FastAPI Configuration
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Frontend Configuration
FRONTEND_URL=http://localhost:3000

# Backend Configuration
BACKEND_HOST=localhost
BACKEND_PORT=8000

# Masa API Token for Tweet Fetching
MASA_API_TOKEN=eWhHVdpvkF4XyCaqLcYJM8zzFs80N64YPyHrabg8VWenepY8

# RunPod API Configuration for AI Analysis
RUNPOD_ENDPOINT_ID=your-endpoint-id
RUNPOD_API_KEY=your-api-key
```

## Project Structure

```
Action_Learning_Platform/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── auth.py          # JWT authentication utilities
│   │   ├── config.py        # Configuration settings
│   │   ├── database.py      # SQLAlchemy models and database setup
│   │   ├── main.py          # FastAPI application and routes
│   │   ├── models.py        # Pydantic models for API
│   │   └── twitter_service.py # Masa API integration service
│   ├── requirements.txt     # Python dependencies
│   └── run.py              # Alternative server runner
├── frontend/
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── TweetCard.js      # Individual tweet display
│   │   │   ├── TweetSearch.js    # Tweet search interface
│   │   │   └── UserProfile.js    # User profile component
│   │   ├── context/        # React context providers
│   │   │   └── AuthContext.js    # Authentication state management
│   │   ├── pages/          # Page components
│   │   │   ├── DashboardPage.js  # Main dashboard with tweet functionality
│   │   │   └── LoginPage.js      # Login and registration forms
│   │   ├── services/       # API service layer
│   │   │   └── api.js           # Axios HTTP client
│   │   └── utils/          # Utility functions
│   ├── package.json        # Node.js dependencies and scripts
│   ├── tailwind.config.js  # Tailwind CSS configuration
│   └── postcss.config.js   # PostCSS configuration
├── .gitignore             # Git ignore patterns
└── README.md              # This file
```

## Dependencies

### Backend Dependencies
- **fastapi** (0.104.1) - Modern web framework
- **uvicorn** (0.24.0) - ASGI server
- **sqlalchemy** (2.0.23) - SQL toolkit and ORM
- **psycopg2-binary** (2.9.9) - PostgreSQL adapter
- **pydantic** (2.5.0) - Data validation and settings
- **python-jose** (3.3.0) - JWT handling
- **passlib** (1.7.4) - Password hashing
- **bcrypt** (4.0.1) - Password hashing algorithm
- **requests** (2.31.0) - HTTP library for API calls

### Frontend Dependencies
- **react** (18.2.0) - JavaScript framework
- **react-router-dom** (6.20.1) - Client-side routing
- **axios** (1.6.2) - HTTP client
- **tailwindcss** (3.3.6) - CSS framework
- **@headlessui/react** (1.7.17) - Unstyled UI components
- **@heroicons/react** (2.0.18) - SVG icons
- **react-hot-toast** (2.4.1) - Toast notifications
- **lucide-react** (0.294.0) - Icon library

## Database Schema

### Users Table
- User authentication and profile information
- Relationships to saved tweets

### Tweet Authors Table
- Twitter user information (name, username, metrics)
- Normalized storage of author data

### Saved Tweets Table
- Tweet content, metadata, and public metrics
- Linked to users and authors
- Automatic timestamps and source tracking

## Security Features

- **Password Security**: Bcrypt hashing with salt
- **JWT Tokens**: Secure authentication with 24-hour expiry
- **CORS Protection**: Configured for frontend domain only
- **SQL Injection Prevention**: Parameterized queries via SQLAlchemy
- **Input Validation**: Pydantic models validate all API inputs
- **Authentication Guards**: Protected routes require valid JWT tokens

## Troubleshooting

### Database Issues
- **Connection Failed**: Verify PostgreSQL is running on port 5432
- **Authentication Error**: Check database credentials in `.env` file
- **Tables Missing**: Backend automatically creates tables on startup
- **Migration Issues**: Delete database and restart for fresh schema

### Authentication Issues
- **Login Failed**: Clear browser localStorage and try again
- **Token Expired**: Tokens expire after 24 hours, login again
- **CORS Errors**: Ensure backend is running on port 8000
- **Registration Failed**: Check for duplicate email/username

### Tweet Fetching Issues
- **No Results**: Try broader search terms or different queries
- **API Errors**: Verify Masa API token is correctly configured
- **Timeout Issues**: Large queries may take time to process
- **Rate Limiting**: Masa API may have usage limits

### Development Issues
- **Port Conflicts**: Ensure ports 3000 (frontend) and 8000 (backend) are available
- **Environment Variables**: Check `.env` file exists and has correct values
- **Package Installation**: Delete `node_modules` and reinstall if needed
- **Python Dependencies**: Use virtual environment to avoid conflicts

## Development

### Adding New Features

1. **Backend Endpoints**: Add routes in `app/main.py`
2. **Database Models**: Update models in `app/database.py`
3. **API Models**: Define Pydantic models in `app/models.py`
4. **Frontend Components**: Add React components in `src/components/`
5. **New Pages**: Create page components in `src/pages/`

### Running in Development

```bash
# Backend with hot reload
cd backend
uvicorn app.main:app --reload

# Frontend with hot reload
cd frontend
npm start
```

### Testing

```bash
# Backend testing
cd backend
pytest

# Frontend testing
cd frontend
npm test

# API testing
# Visit http://localhost:8000/docs for interactive testing
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and add tests
4. Commit changes: `git commit -am 'Add feature'`
5. Push to branch: `git push origin feature-name`
6. Submit a pull request

## License

This project is for educational and research purposes.

## Support

For issues or questions:

1. **Check Logs**: Backend logs show detailed error information
2. **API Documentation**: Visit http://localhost:8000/docs for endpoint details
3. **Configuration**: Use `/debug/config` endpoint to verify setup
4. **Database**: Check PostgreSQL logs for connection issues
5. **Network**: Verify no firewall blocking ports 3000/8000

## Changelog

### Current Version
- ✅ Tweet persistence in PostgreSQL database
- ✅ Enhanced user authentication with JWT
- ✅ Saved tweets history and retrieval
- ✅ Modern React 18 frontend with improved UI
- ✅ Comprehensive error handling and logging
- ✅ Automatic tweet storage with author information
- ✅ Debug endpoints for development
- ✅ Enhanced API documentation
