# DegreeTrackr - Education Tracking Platform

## Overview
DegreeTrackr is a React + TypeScript frontend for Chapman University students to track education and courses, primarily backed by Convex + Clerk with legacy Flask flows retained only where needed.

## Project Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Material-UI (MUI) + Tailwind CSS
- **Port**: 3333 (mapped to port 80 in Replit deployments)
- **Features**:
  - User authentication (Clerk + legacy fallback)
  - User preferences storage
  - Progress and scheduling tools

### Backend
- **Framework**: Flask (Python 3.11, legacy)
- **Port**: 5000 (optional, legacy-only endpoints)
- **Features**:
  - RESTful API endpoints used by migration-carryover paths
  - JWT authentication
  - CORS enabled

### API Endpoints
- `GET /health` - Health check endpoint
- `POST /auth/sign-in` - User sign-in
- `POST /auth/sign-up` - User registration
- `GET /auth/preferences` - Get user preferences (requires JWT)

## Development Setup

### Running the Application
Use Replit's Run button workflows (or run the commands manually):

- **Dev** → `npm run dev` (default). Runs Vite on `3333`.
- **Backend services**: start with `npm run dev:server` only when needed.

### Project Structure
```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py          # Flask application
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── auth/            # Authentication context
│   │   ├── components/      # React components
│   │   └── lib/             # API utilities
│   ├── config/
│   │   └── app.json         # Frontend config
│   ├── package.json
│   └── vite.config.ts       # Vite configuration
└── package.json             # Root package with concurrently

```

## Configuration

### Frontend Configuration
- API base URL: `/api` remains available for legacy routes; Convex is the default data layer
- Host: `0.0.0.0` (accessible via Replit preview)
- Port: `CLIENT_PORT` env (defaults to `3333`, exposed as port `80` in Replit)

### Backend Configuration
- Host: `0.0.0.0`
- Port: `5000` (legacy backend only)
- JWT Secret: Configured via `JWT_SECRET_KEY` environment variable (defaults to dev key)

## Dependencies

### Backend (Python)
- flask - Web framework
- flask-cors - CORS support
- pyjwt - JWT token handling
- waitress - Production WSGI server
- python-dotenv - Environment variables
- requests - HTTP client
- sqlalchemy - Database ORM
- alembic - Database migrations
- psycopg - PostgreSQL adapter

### Frontend (Node.js)
- react - UI framework
- react-dom - React DOM renderer
- @mui/material - Material-UI components
- @emotion/react & @emotion/styled - CSS-in-JS
- react-icons - Icon library
- vite - Build tool
- typescript - Type safety

## Deployment
The frontend is deployment-first and runs as a static server process (`cd frontend && npm run preview`) with optional legacy backend processes managed separately.

## Recent Changes
- 2025-12-04: Major robustness improvements to prevent crashes
  - Added global error handlers to Flask backend for all HTTP errors (400, 404, 405, 500, 502, 503)
  - Added JSON validation middleware to catch malformed requests
  - Improved Supabase client with retry logic (3 retries with exponential backoff)
  - Added React Error Boundary to prevent UI crashes from breaking the entire app
  - Improved AuthContext with health checks, token validation, and error recovery
  - Added backend_unavailable state for graceful degradation when server is down
  - Created robust API client wrapper with retry logic and timeout handling
  
- 2025-11-12: Initial setup for Replit environment
  - Created Flask backend with auth endpoints
  - Configured Vite to run on port 5173 with backend proxy
  - Integrated frontend with real backend API calls
  - Set up unified development workflow

## User Preferences
- Requires Chapman.edu email for authentication
- Currently using stub authentication (to be connected to actual database/Supabase)
- JWT tokens stored in localStorage
