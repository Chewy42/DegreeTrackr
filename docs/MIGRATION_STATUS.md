# DegreeTrackr: Architecture Status

**Last updated:** 2026-03-11
**Scope:** Active serverless architecture after removing the in-repo Flask backend and Supabase-era migration artifacts.

---

## Current architecture

DegreeTrackr now treats the frontend and serverless providers as the only supported app runtime in this repository.

- Frontend: Vite + React + TypeScript on port `3333`
- App backend: Convex (`chat`, `profile`, `evaluations`, `scheduleSnapshots`, `userState`, `legacyHydration`)
- Auth: Clerk
- Email: Resend
- Billing: Polar
- Deployment target: Cloudflare Pages

The repo no longer contains the legacy Flask backend, Supabase setup scripts, or Python CI/runtime wiring.

## Historical metadata that remains intentionally

The `MigrationSource = 'legacy-flask' | 'convex'` tag still exists in Convex and frontend contracts to preserve record provenance for already-migrated data. It is historical metadata only; it does not mean the repo still ships a Flask runtime.

## Deferred legacy client seams

Some frontend utilities and Convex actions still point at optional legacy bridge integrations. These are no longer part of the supported local setup and should be treated as deferred replacement work rather than active architecture.

| Area | File(s) | Current state |
|---|---|---|
| Explore upcoming classes | `frontend/src/components/ExploreClassesSidebar.tsx` | Still fetches `/api/classes/upcoming`; requires a replacement data source before it can be considered supported in the serverless-only repo. |
| Explore chat bridge | `frontend/src/lib/convex/chatHelpers.ts`, `convex/chat.ts` | Session storage now lives in Convex, but sending explore chat prompts still depends on the legacy `/chat/explore` bridge. |
| Schedule builder bridge | `frontend/src/lib/scheduleApi.ts` | Snapshot storage uses Convex, but class-search and generation helpers still target legacy `/api/schedule/*` endpoints. |
| Program evaluation bridge | `frontend/src/lib/convex/evaluationHelpers.ts` | Upload and hydration helpers still expect an external `/api/program-evaluations` bridge. |

## Repo cleanup completed in this wave

- Removed `backend/` from the active repository tree.
- Removed backend-specific root scripts and CI jobs.
- Removed Supabase-specific setup artifacts from active repo structure.
- Updated env examples and workflow docs to describe the serverless stack.

## Local development expectations

- Run `npm run dev` from the repo root to start the frontend shell.
- Set `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_CONVEX_URL` for the frontend.
- Set `VITE_API_BASE_URL` (or inject a runtime `apiBaseUrl`) before testing Clerk session exchange or any deferred `/api/*` bridge flow.
- Without that bridge, the app now stops at an explicit setup-required state after Clerk sign-in instead of surfacing a misleading temporary outage screen.

## Deployment expectations

- Build with `npm run build`.
- Deploy the frontend to Cloudflare Pages.
- Configure provider secrets outside the repo for Clerk, Convex, Resend, Polar, and Cloudflare.

## Remaining follow-up work outside this wave

- Replace or remove the deferred `/api/*` client seams listed above.
- Provision a production Convex deployment if only a development deployment exists.
- Wire Resend and Polar flows fully when product requirements require them.
