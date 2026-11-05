# AI for Mental Health Analysis

A full-stack web app that fetches a user's public tweets, classifies each one with a mental-health text classifier, turns the results into a written report, and offers a voice-enabled AI counselor chat grounded in that report.

> **Not a medical tool.** This is a student research and learning project. Its outputs are not a diagnosis and do not replace a mental health professional.

## What it does

1. **Fetch tweets** by keyword or username through the Masa API. Results are cached and saved per user in PostgreSQL.
2. **Classify each tweet** by sending its text to a classifier on a RunPod serverless endpoint. The endpoint returns a label, a confidence score and the full class probabilities, and the backend stores these for each tweet. A single tweet or all saved tweets can be classified at once.
3. **Generate a report.** The backend aggregates the classifications (counts per class plus sample tweets) and asks Gemini Flash 1.5 (via OpenRouter, called through LiteLLM) to write a summary report. Reports are saved and can be reopened later.
4. **Talk to a counselor.** A chat endpoint uses the latest report and recent conversation (last 10 messages) as context, with a system prompt that keeps replies supportive and points the user to professional help.
5. **Use voice.** ElevenLabs Flash v2.5 handles text-to-speech and ElevenLabs Scribe v1 handles speech-to-text, so the counselor chat works by voice.

## Architecture

```
React (Dashboard, Report, Counselor, VoiceChat)
        │  JWT
        ▼
FastAPI backend ──► Masa API (tweets)
   │   │   │
   │   │   └────► RunPod endpoint (tweet classifier)
   │   └────────► OpenRouter / Gemini Flash 1.5 via LiteLLM (reports, counselor)
   └────────────► ElevenLabs (TTS / STT)
   │
PostgreSQL (users, saved tweets, analyses, reports)
```

**Backend:** FastAPI, SQLAlchemy, PostgreSQL, python-jose (JWT, 24 h tokens), passlib/bcrypt, LiteLLM, ElevenLabs SDK.
**Frontend:** React 18, React Router (protected routes), Tailwind CSS, HeadlessUI, Axios, React Hot Toast.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Create an account or log in (returns a JWT) |
| GET | `/user/me` | Current user |
| POST | `/tweets/search`, `/tweets/user` | Fetch tweets by query or username |
| GET | `/tweets/saved` | The user's saved tweets |
| POST | `/tweets/download` | Export saved tweets |
| POST | `/tweets/analyze` | Classify one tweet |
| POST | `/tweets/analyze-all` | Classify every saved tweet |
| POST | `/reports/generate` | Build a report from the classifications |
| GET | `/reports/latest`, `/reports/{id}` | Read reports |
| POST | `/counselor/chat` | Counselor reply grounded in the latest report |
| POST | `/voice/tts`, `/voice/stt` | Text-to-speech, speech-to-text |
| GET | `/health` | Health check |

Interactive docs are at `http://localhost:8000/docs` once the backend runs.

## Quick start

**Requirements:** Python 3.10+, Node.js 18+, PostgreSQL 12+, and API keys for Masa, RunPod, OpenRouter and ElevenLabs.

```bash
git clone https://github.com/PriyankaSIRIKONDA/AI-For-Mental-Health-Analysis.git
cd AI-For-Mental-Health-Analysis

# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env        # then fill in your own keys
python run.py               # http://localhost:8000

# Frontend (new terminal)
cd frontend
npm install
npm start                   # http://localhost:3000
```

## Configuration

All secrets are read from `backend/.env` (see `backend/.env.example`). `.env` is git-ignored; never put keys in code.

| Variable | Used for |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `SECRET_KEY` | JWT signing |
| `MASA_API_TOKEN` | Tweet fetching |
| `RUNPOD_ENDPOINT_ID`, `RUNPOD_API_KEY` | Tweet classifier endpoint |
| `OPENROUTER_API_KEY` | Reports and counselor chat |
| `ELEVENLABS_API_KEY` | Voice |

`GET /debug/config` shows which settings are set (true/false only, never the values). Remove it before deploying.

## Project structure

```
backend/
  app/
    main.py            # API routes
    config.py          # settings loaded from .env
    database.py        # SQLAlchemy models and helpers
    auth.py            # JWT and password hashing
    twitter_service.py # Masa API client
    models.py          # Pydantic request/response models
  run.py
frontend/
  src/
    pages/             # Login, Dashboard, Report, Counselor
    components/        # TweetSearch, TweetCard, UserProfile, VoiceChat
    services/api.js
```

## Team and credits

Built by a team of three for the EPITA Action Learning project (Spring 2025): **Priyanka Sirikonda**, **Cihan Karadoğan** and **Nguyen Minh Chau**. This repository is a copy of the team's code; the full commit history lives in the team repository. Contributions below follow that history.

- **Priyanka Sirikonda:** RunPod inference integration: the `/tweets/analyze` (single tweet) and `/tweets/analyze-all` (bulk) endpoints that send tweets to the classifier on the RunPod serverless endpoint, storage of the results, and the analysis UI in the dashboard (`TweetCard`, `DashboardPage`, API client). Team repo commit `60506c3`, 22 Jul 2025.
- **Cihan Karadoğan:** project setup, Twitter authentication and tweet fetching, search caching, text-to-speech and speech-to-text with ElevenLabs.
- **Nguyen Minh Chau:** counselor chatbot and report generation.

The classifier itself was trained outside this repository and served from RunPod.

## Limitations

- The classifier is served from a separate RunPod endpoint. Its training code and evaluation are not in this repository.
- Tweets are short and missing context, so a single post is weak evidence of anyone's mental state. Reports describe patterns in posts, not people.
- The counselor is an LLM prompt, not a clinically validated intervention.

## Changelog

- **Nov 2026:** added a team and credits section. Earlier: moved all API keys out of the code into `.env` settings, added `.env.example`, and rewrote this README to match the current features.
