# Deployment Guide

DegreeTrackr ships as a Vite static frontend on **Cloudflare Pages** with **Convex** serverless backend and **Clerk** authentication.

## Prerequisites

- Node 18+ (20+ recommended)
- Convex CLI (`npx convex`)
- Clerk account with an application configured
- Cloudflare account with Pages enabled
- Git repository connected to GitHub (for Cloudflare Pages auto-deploy)

## Environment variables

### Required (app will not boot without these)

| Variable | Description |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk frontend publishable key — checked at startup in `main.tsx` |
| `VITE_CONVEX_URL` | Convex deployment URL (e.g. `https://<deployment>.convex.cloud`) |

### Required while legacy bridge seams exist

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL for remaining `/api/*` legacy endpoints (Clerk session exchange, schedule search, program evaluation parsing) |

### Optional

| Variable | Default | Description |
|---|---|---|
| `VITE_ROUTER_BASENAME` | `/` | Router base path — set only when serving from a sub-path |
| `VITE_SENTRY_DSN` | _(disabled)_ | Sentry error monitoring DSN |
| `VITE_SENTRY_ADMIN_ROUTES` | `/admin` | Comma-separated admin routes for Sentry sampling |
| `VITE_ALLOWED_HOSTS` | _(none)_ | Comma-separated allowed hosts for Vite dev server |

## Local development

```bash
# Install dependencies
npm install && cd frontend && npm install

# Start Convex dev server (in one terminal)
npx convex dev

# Start Vite dev server (in another terminal)
cd frontend && npm run dev
```

The frontend dev server runs on `http://localhost:3333`.

Create a `.env.local` in the repo root or `frontend/` with the required variables before starting.

## Cloudflare Pages deployment

### Connect via GitHub

1. In the Cloudflare dashboard, create a new Pages project connected to the GitHub repo.
2. Configure build settings:
   - **Build command:** `cd frontend && npm run build`
   - **Build output directory:** `frontend/dist`
   - **Node version:** 20 (set via `NODE_VERSION` environment variable)
3. Add all required environment variables in the Pages project settings.

### Manual deploy

```bash
npm run build
npx wrangler pages deploy frontend/dist --project-name <your-pages-project>
```

### SPA routing

The repo ships `frontend/public/_redirects` with `/* /index.html 200` so direct visits to nested routes work without 404s.

### Pre-deploy validation

```bash
npm run check:pages-release
```

This checks `wrangler.toml` config, verifies `_redirects` is in the build output, and validates env example coverage.

## Clerk setup

1. Create a Clerk application at [clerk.com](https://clerk.com).
2. Copy the **Publishable Key** → set as `VITE_CLERK_PUBLISHABLE_KEY` in Pages env vars.
3. If using the legacy bridge, copy the **Secret Key** → set as `CLERK_SECRET_KEY` on the bridge server.
4. Add your Cloudflare Pages domain to Clerk's allowed origins.
5. In Convex dashboard, configure the Clerk integration so Convex can verify Clerk JWTs.

## Convex setup

1. Run `npx convex dev` locally to create a development deployment.
2. For production, create a production deployment via `npx convex deploy`.
3. Copy the production deployment URL → set as `VITE_CONVEX_URL`.
4. Verify the Clerk instance is authorized to talk to the Convex deployment.

## Verification checklist

Before calling a deployment production-ready:

- [ ] `npm run check:pages-release` passes
- [ ] Deployed site boots on a nested route (e.g. `/settings`)
- [ ] Clerk sign-in works on the deployed origin
- [ ] Convex-backed reads succeed with the production `VITE_CONVEX_URL`
- [ ] Legacy bridge flows work via `VITE_API_BASE_URL` (until fully removed)

See `docs/CLOUD_ENV_SETUP.md` for additional Cloudflare Pages configuration details.
