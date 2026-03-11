# CLAUDE.md — DegreeTrackr

DegreeTrackr is a serverless-first app with a Vite React frontend, Convex backend functions, Clerk auth, and Cloudflare Pages deployment targets.

## Project Overview

- Frontend stack: React 18, TypeScript, Vite, Clerk, Convex, MUI, Tailwind.
- Backend/services stack: Convex functions for app data, Clerk for auth, Resend for transactional email, Polar for billing seams, Cloudflare Pages for frontend hosting.
- The legacy Flask/Supabase repo runtime has been removed; any remaining `/api/*` references are deferred client-side seams, not supported local defaults.
- Replit workflow files are present and still document important local port and workflow assumptions.

## Commands

### Root

```bash
npm run dev
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

## Architecture

- `frontend/` is the Vite client app.
- `convex/` contains serverless backend modules and schema.
- `docs/MIGRATION_STATUS.md` documents the serverless architecture and any deferred legacy client integration seams.
- `.replit` and `replit.md` still matter for local workflow assumptions and port mapping.

## Workflow Notes

- Treat this repo as frontend-first and serverless by default.
- `VITE_CONVEX_URL` must be set for Convex-backed flows.
- Clerk is the active auth provider in the frontend.
- Cloudflare Pages is the intended deployment target for the frontend app.
- Resend and Polar are the intended external provider seams when those flows are wired up.
- Keep strict types, favor smaller files when modules grow too large, and back new logic with tests.
- Avoid creating redundant markdown report files; use existing docs only when they are the right home.

## Verification Expectations

- Frontend changes: run `npm run typecheck` and `npm run test` in `frontend/`.
- Cross-cutting changes: run root `npm run build` and use targeted repo searches when the change updates architecture docs, metadata, or legacy integration seams.
