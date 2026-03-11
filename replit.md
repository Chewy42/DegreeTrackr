# DegreeTrackr - Education Tracking Platform

## Overview
DegreeTrackr is a React + TypeScript frontend for Chapman University students to track education and courses, backed by Convex + Clerk with Cloudflare Pages as the intended deployment target.

## Project Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Material-UI (MUI) + Tailwind CSS
- **Port**: 3333 (mapped to port 80 in Replit deployments)
- **Features**:
  - User authentication (Clerk)
  - User preferences storage
  - Progress and scheduling tools

### Services
- **Application data**: Convex
- **Authentication**: Clerk
- **Email**: Resend
- **Billing**: Polar
- **Deployment**: Cloudflare Pages

## Development Setup

### Running the Application
Use Replit's Run button workflow (or run the command manually):

- **Dev** -> `npm run dev` (default). Runs Vite on `3333`.

### Project Structure
```
.
├── frontend/
│   ├── src/
│   │   ├── auth/            # Authentication context
│   │   ├── components/      # React components
│   │   └── lib/             # Runtime and legacy bridge utilities
│   ├── config/
│   │   └── app.json         # Frontend config
│   ├── package.json
│   └── vite.config.ts       # Vite configuration
├── convex/                  # Serverless backend modules and schema
├── docs/                    # Architecture and migration notes
└── package.json             # Root package scripts
```

## Configuration

### Frontend Configuration
- Convex URL: `VITE_CONVEX_URL`
- Clerk publishable key: `VITE_CLERK_PUBLISHABLE_KEY`
- Optional legacy bridge URL: `VITE_API_BASE_URL` for deferred `/api/*` seams only
- Host: `0.0.0.0` (accessible via Replit preview)
- Port: `CLIENT_PORT` env (defaults to `3333`, exposed as port `80` in Replit)

## Dependencies

### Frontend (Node.js)
- react - UI framework
- react-dom - React DOM renderer
- @mui/material - Material-UI components
- @emotion/react & @emotion/styled - CSS-in-JS
- react-icons - Icon library
- vite - Build tool
- typescript - Type safety

## Deployment
The frontend is deployment-first and builds with `npm run build`, intended for Cloudflare Pages.

## Recent Changes
- 2026-03-11: Serverless architecture cleanup
  - Removed the in-repo Flask backend and Supabase-era setup artifacts from active repo metadata
  - Updated Replit workflow docs to reflect the frontend-only local development flow on port 3333
  - Marked remaining `/api/*` client integrations as deferred legacy seams instead of active runtime defaults

## User Preferences
- Requires Chapman.edu email for authentication
- Clerk is the authentication provider of record
