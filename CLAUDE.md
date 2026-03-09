# CLAUDE.md — DegreeTrackr

DegreeTrackr is a hybrid migration-state app with a Vite React frontend, a Flask backend, and newer Convex + Clerk integrations.

## Project Overview

- Frontend stack: React 18, TypeScript, Vite, Clerk, Convex, MUI, Tailwind.
- Backend stack: Flask, SQLAlchemy, JWT auth helpers, Supabase-era services still present.
- Convex is live and wired into the frontend, but the app still has Flask fallback paths and legacy backend responsibilities.
- Replit workflow files are present and still document important local port and workflow assumptions.

## Commands

### Root

```bash
npm run dev
npm run dev:server
npm run build
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run typecheck
npm run test
```

### Backend

```bash
cd backend
python -m flask --app app.main:app run --host=0.0.0.0 --port=5000
pytest
```

## Architecture

- `frontend/` is the Vite client app.
- `backend/` is the Flask API and legacy business logic surface.
- `convex/` contains newer backend modules and schema.
- `docs/MIGRATION_STATUS.md` is the best snapshot of what has moved to Convex and what still falls back to Flask.
- `.replit` and `replit.md` still matter for local workflow assumptions and port mapping.

## Workflow Notes

- Treat this repo as mixed-mode, not fully migrated.
- `VITE_CONVEX_URL` must be set for Convex-backed flows; otherwise the app falls back to Flask behavior.
- Clerk is the active auth provider in the frontend.
- Keep strict types, favor smaller files when modules grow too large, and back new logic with tests.
- Avoid creating redundant markdown report files; use existing docs only when they are the right home.

## Verification Expectations

- Frontend changes: run `npm run typecheck` and `npm run test` in `frontend/`.
- Backend changes: run `pytest` in `backend/`.
- Cross-cutting changes: run root `npm run dev` locally if the change touches the frontend-backend interaction surface.
