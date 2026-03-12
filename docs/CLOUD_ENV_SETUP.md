# Cloud Environment Setup

DegreeTrackr ships as a Vite frontend for **Cloudflare Pages** with **Clerk** and **Convex**.

## Cloudflare Pages build settings

- **Framework preset:** None / Vite-compatible static build
- **Build command:** `npm run build`
- **Build output directory:** `frontend/dist`
- **Node version:** 20+ recommended
- **Checked-in Pages config:** `wrangler.toml` (`pages_build_output_dir = \"frontend/dist\"`)
- **Reusable release check:** `npm run check:pages-release`

## Required Cloudflare Pages environment variables

### Required for every deployment

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`

### Required while legacy bridge seams still exist

- `VITE_API_BASE_URL`

As of 2026-03-12, the remaining bridge-dependent flows are:
- Clerk session exchange (`/api/auth/clerk/session`)
- backend health check (`/api/health`)
- schedule class search / lookup / auto-generate (`/api/schedule/*` remaining subset)
- program evaluation PDF parsing + preview bytes (`/api/program-evaluations` remaining subset)

## Convex deployment readiness

Before pointing Pages at production traffic:

1. Create or confirm a **production Convex deployment**.
2. Copy the production deployment URL into `VITE_CONVEX_URL`.
3. Verify the Clerk instance used in production is allowed to talk to that frontend origin.
4. Verify Convex-authenticated flows work with the same Clerk tenant.

## SPA routing requirement

DegreeTrackr uses `BrowserRouter`, so Cloudflare Pages needs an SPA fallback. This repo now ships:

- `frontend/public/_redirects` → `/* /index.html 200`

That ensures direct visits and refreshes on nested routes do not 404 in production.

## Dry-run deploy checklist

Before calling the app deploy-ready, verify:

- `npm run check:pages-release` succeeds from the repo root
- the deployed site boots on a nested route (for example `/settings` or `/schedule-gen-home`)
- Clerk sign-in works in the deployed origin
- Convex-backed reads succeed with the production `VITE_CONVEX_URL`
- remaining bridge-backed flows use the intended `VITE_API_BASE_URL`

## Deploy command

Once the Cloudflare project exists and env vars are configured, the static artifact can be deployed reproducibly with:

- `npx wrangler pages deploy frontend/dist --project-name <your-pages-project>`

## Current reality

This repo is closer to serverless-native than before, but it is **not** yet fully bridge-free. Treat `VITE_API_BASE_URL` as required for production until the remaining deferred seams are removed.
