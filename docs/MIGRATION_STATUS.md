# DegreeTrackr: Convex Migration Status

**Last updated:** 2026-03-07 (migration complete — all autonomously-doable flows migrated)
**Scope:** Flask → Convex backend migration audit

---

## Overview

The app is migrating from a Flask/Supabase backend to Convex. The migration uses a
`MigrationSource = 'legacy-flask' | 'convex'` tag (defined in `frontend/src/lib/convex/contracts.ts`)
to track the origin of records in Convex.

**Current state:** ✅ **Convex is fully deployed and wired into the React app.**
- Deployment: `dev:hip-lynx-867` → `https://hip-lynx-867.convex.cloud`
- Six Convex modules live: `chat`, `profile`, `evaluations`, `scheduleSnapshots`, `legacyHydration`, `userState`
- `ConvexProviderWithClerk` is in `main.tsx` — all Convex hooks (`useQuery`/`useMutation`) work app-wide
- **All major data flows use Convex as primary with Flask fallback**:
  - `AuthContext.refreshPreferences` → `profile:getCurrentUserPreferences` (query, skips Flask when data available)
  - `OnboardingChat.handleFinish` → `profile:completeCurrentOnboarding` (mutation, Flask fallback)
  - `SettingsPage` scheduling prefs → `profile:getCurrentSchedulingPreferences` + `updateCurrentSchedulingPreferences`
  - Schedule snapshots → `scheduleSnapshots:*` (3 functions, Flask fallback)
  - Program evaluations → `evaluations:*` (5 functions, dual-path with Flask for PDF handling)
  - Chat sessions → `chat:*` (10 functions, dual-path with Flask for AI generation)
- **Remaining on Flask-only** (intentionally deferred): auth (Clerk session exchange, email/password signup/signin), schedule builder class search/validation/generation (Python-dependent)

⚠️ **Action needed:** Set `VITE_CONVEX_URL=https://hip-lynx-867.convex.cloud` in deployment environment variables. See `frontend/.env.example`.

---

## Current State Table

| Feature Area | Endpoint(s) | Backend | Status |
|---|---|---|---|
| **Chat – explore messages** | `POST /chat/explore`, `/chat/explore/stream` | Flask (AI) + Convex (storage) | ⚠️ Dual-path: Flask generates AI reply, Convex stores session via `syncCurrentChatSessionFromLegacy` |
| **Chat – explore sessions** | `GET /chat/sessions`, `DELETE /chat/sessions[/<id>]` | Convex | ✅ Migrated — frontend uses `chat:listCurrentUserSessions`, `deleteSession`, `clearExploreSessions` |
| **Chat – session history** | `GET /chat/history/<id>` | Convex | ✅ Migrated — frontend uses `chat:getSessionMessages` |
| **Chat – onboarding flow** | `POST /chat/onboarding`, `/chat/onboarding/stream` | Flask (AI) + Convex (state) | ⚠️ Dual-path: AI still on Flask; `getCurrentOnboardingFlowState`, `saveCurrentOnboardingFlow` in Convex |
| **Program evaluation – upload** | `POST /program-evaluations` | Flask (file + parse) + Convex (sync) | ⚠️ Dual-path: `evaluationHelpers.ts` uploads to Flask then calls `evaluations:replaceCurrentProgramEvaluationFromUpload` to sync |
| **Program evaluation – read** | `GET /program-evaluations/parsed` | Convex (primary) / Flask (fallback) | ⚠️ Dual-path: `ProgressPage.tsx` queries `evaluations:getCurrentProgramEvaluation` first, falls back to `evaluations:hydrateCurrentProgramEvaluationFromLegacy` |
| **Program evaluation – delete** | `DELETE /program-evaluations` | Flask + Convex | ⚠️ Dual-path: deletes from Flask storage then calls `evaluations:clearCurrentProgramEvaluation` |
| **User preferences** | `GET /auth/preferences`, `POST /auth/preferences` | Convex (primary) / Flask (fallback) | ✅ Migrated — `AuthContext.refreshPreferences` uses `profile:getCurrentUserPreferences` query; skips Flask fetch when Convex has data. `OnboardingChat.handleFinish` uses `profile:completeCurrentOnboarding` mutation with Flask fallback. |
| **Scheduling preferences** | `GET /auth/scheduling-preferences`, `PATCH /auth/scheduling-preferences` | Convex (primary) / Flask (fallback) | ✅ Migrated — `SettingsPage` uses `profile:getCurrentSchedulingPreferences` query + `profile:updateCurrentSchedulingPreferences` mutation; Flask called only when Convex unavailable. |
| **Upcoming classes** | `GET /classes/upcoming` | Flask | ✅ Live — `ExploreClassesSidebar.tsx` fetches from Flask `/api/classes/upcoming` endpoint (implemented PR #24). |
| **Schedule snapshots** | `POST/GET/DELETE /schedule/snapshots` | Flask (fallback) + Convex (primary) | ✅ Migrated — `scheduleApi.ts` uses Convex `scheduleSnapshots:*` with Flask fallback (PR #28). Convex schema + 3 functions deployed. |
| **Schedule builder – class search** | `GET /schedule/classes[/<id>]` | Flask | 🔴 Legacy only |
| **Schedule builder – validate** | `POST /schedule/validate` | Flask | 🔴 Legacy only |
| **Schedule builder – auto-generate** | `POST /schedule/generate` | Flask | 🔴 Legacy only |
| **Schedule builder – requirements** | `GET /schedule/user-requirements`, `/schedule/subjects`, `/schedule/stats` | Flask | 🔴 Legacy only |
| **Authentication – Clerk session** | `POST /auth/clerk/session` | Flask | 🔴 Legacy only — exchanges Clerk token for app JWT via Flask/Supabase |
| **Authentication – email/password** | `POST /auth/sign-up`, `/auth/sign-in`, `/auth/resend-confirmation` | Flask | 🔴 Legacy only |
| **Health checks** | `GET /health`, `/health/config` | Flask | 🟡 No migration planned (infra concern) |

---

## Flask Endpoints Still Active (Full List)

### `backend/app/main.py` (registered directly)
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/health/config` | Config diagnostics |
| POST | `/auth/clerk/session` | Clerk → app JWT exchange |
| POST | `/auth/sign-up` | Email/password registration |
| POST | `/auth/sign-in` | Email/password login |
| POST | `/auth/resend-confirmation` | Resend email verification |
| GET | `/auth/preferences` | Read user + onboarding preferences |
| POST | `/auth/preferences` | Write user + onboarding preferences |
| GET | `/auth/scheduling-preferences` | Read scheduling preferences |
| PATCH | `/auth/scheduling-preferences` | Update scheduling preferences |
| GET | `/classes/upcoming` | List upcoming grad-level classes |

### `backend/app/routes/chat.py`
| Method | Path | Purpose |
|---|---|---|
| POST | `/chat/onboarding` | Onboarding chat turn (standard) |
| POST | `/chat/onboarding/stream` | Onboarding chat turn (SSE stream) |
| GET | `/chat/sessions` | List user's chat sessions |
| DELETE | `/chat/sessions/<id>` | Delete a session |
| DELETE | `/chat/sessions` | Clear sessions by scope |
| GET | `/chat/history/<id>` | Get session message history |
| POST | `/chat/explore` | Explore chat turn (standard) |
| POST | `/chat/explore/stream` | Explore chat turn (SSE stream) |

### `backend/app/routes/evaluations_v2.py`
| Method | Path | Purpose |
|---|---|---|
| POST | `/program-evaluations` | Upload + parse program evaluation PDF |
| GET | `/program-evaluations` | Download raw PDF |
| GET | `/program-evaluations/parsed` | Get parsed evaluation JSON |
| DELETE | `/program-evaluations` | Delete evaluation |

### `backend/app/routes/schedule.py`
| Method | Path | Purpose |
|---|---|---|
| POST | `/schedule/generate` | Auto-generate a schedule |
| GET | `/schedule/classes` | Search/filter class catalog |
| GET | `/schedule/classes/<id>` | Get single class detail |
| POST | `/schedule/validate` | Validate schedule for conflicts |
| GET | `/schedule/user-requirements` | Remaining degree requirements |
| GET | `/schedule/subjects` | Subject list for filters |
| GET | `/schedule/stats` | Class catalog statistics |
| POST | `/schedule/snapshots` | Save schedule snapshot (Convex primary) |
| GET | `/schedule/snapshots` | List saved snapshots (Convex primary) |
| GET | `/schedule/snapshots/<id>` | Get single snapshot |
| DELETE | `/schedule/snapshots/<id>` | Delete snapshot (Convex primary) |
| PATCH | `/schedule/snapshots/<id>` | Update snapshot |

---

## Convex Functions (Deployed — `dev:hip-lynx-867`)

### `convex/chat.ts`
| Name | Type | Description |
|---|---|---|
| `listCurrentChatSessions` | query | List sessions by scope for current user |
| `getCurrentChatSession` | query | Get session + messages by ID |
| `getCurrentOnboardingFlowState` | query | Get onboarding answers + step |
| `syncCurrentChatSessionFromLegacy` | mutation | Upsert a session synced from Flask |
| `saveCurrentOnboardingFlow` | mutation | Save onboarding answers + step |
| `resetCurrentOnboardingFlow` | mutation | Delete all onboarding sessions |
| `deleteCurrentChatSession` | mutation | Delete a session by ID |
| `clearCurrentChatSessions` | mutation | Bulk-delete sessions by scope |
| `hydrateCurrentChatSessionsFromLegacy` | action | Pull all sessions from Flask and sync to Convex |
| `sendCurrentExploreMessage` | action | Call Flask explore endpoint and sync result to Convex |

### `convex/profile.ts` (new — PR #25)
| Name | Type | Description |
|---|---|---|
| `getCurrentUserProfile` | query | Get profile for current user |
| `getCurrentUserPreferences` | query | Get user preferences |
| `getCurrentSchedulingPreferences` | query | Get scheduling preferences |
| `upsertCurrentUserProfile` | mutation | Create or update user profile |
| `updateCurrentUserPreferences` | mutation | Update user preferences |
| `updateCurrentSchedulingPreferences` | mutation | Update scheduling preferences |
| `completeCurrentOnboarding` | mutation | Mark onboarding complete + save answers |
| `hydrateCurrentUserPreferencesFromLegacy` | action | Pull prefs from Flask and sync |
| `syncCurrentSchedulingPreferencesFromLegacy` | action | Pull scheduling prefs from Flask and sync |

### `convex/evaluations.ts` (new — PR #26)
| Name | Type | Description |
|---|---|---|
| `getCurrentProgramEvaluation` | query | Get current evaluation for user |
| `replaceCurrentProgramEvaluationFromUpload` | mutation | Sync evaluation data from Flask upload |
| `hydrateCurrentProgramEvaluationFromLegacy` | mutation | Pull + store evaluation from Flask |
| `clearCurrentProgramEvaluation` | mutation | Delete evaluation record |
| `updateCurrentProgramEvaluationStatus` | mutation | Update processing status |

### `convex/scheduleSnapshots.ts` (new — PR #28)
| Name | Type | Description |
|---|---|---|
| `listCurrentScheduleSnapshots` | query | List all snapshots for current user (newest first) |
| `createCurrentScheduleSnapshot` | mutation | Insert a new snapshot |
| `deleteCurrentScheduleSnapshot` | mutation | Delete snapshot (ownership-checked) |

### `convex/legacyHydration.ts` + `convex/userState.ts`
Stub files — resolve import dependencies in `chat.ts`. No exported functions yet.

---

## Remaining Migration Opportunities

### ✅ Done (as of 2026-03-07)
All autonomously-doable migrations are complete. The Convex provider is live, hooks work app-wide, and all non-Python, non-auth data flows use Convex as primary.

### 🔚 Intentionally deferred

**Schedule Builder** (class search, validate, generate, requirements, subjects, stats):
- Depends on local Python degree-requirements engine and CSV data files
- The schedule generator (`schedule_generator.py`) is tightly coupled to Python services
- No Convex infrastructure exists for this domain — leave on Flask indefinitely

**Authentication** (Clerk session exchange, email/password signup/signin):
- The existing auth system uses Flask-issued JWTs (from `/api/auth/clerk/session`)
- Full migration requires replacing the Flask JWT system with Clerk-native auth
- Complex Supabase data cut-over required — defer until a dedicated auth overhaul

---

## Remaining Risks

| # | Risk | Severity | Notes |
|---|---|---|---|
| 1 | `VITE_CONVEX_URL` not set in deployment env | 🟠 High | Must be set to `https://hip-lynx-867.convex.cloud` in production deploy env vars. Without it, all Convex calls are no-ops and the app falls back entirely to Flask. See `frontend/.env.example`. |
| 2 | Auth is still Flask-issued JWTs | 🟡 Medium | Convex uses Clerk tokens for identity. The app still requires a Flask JWT from `/auth/clerk/session` to call Flask endpoints. Convex flows work in parallel without the Flask JWT. |
| 3 | Supabase still required for Flask features | 🟡 Medium | User records, evaluations metadata, and auth still live in Supabase. Full cut-over requires a data migration plan. |
| 4 | Program evaluation PDF storage | 🟡 Medium | Files are in Supabase Storage. Acceptable medium-term; migrate to Convex file storage when ready. |
| 5 | Dev vs prod Convex deployment | 🟡 Medium | Only `dev:hip-lynx-867` is provisioned. Run `npx convex deploy` from the repo to create a production deployment before going live. |
| 6 | Schedule builder Python coupling | 🟢 Low | No Convex migration path exists; leave it on Flask indefinitely. |
