# DegreeTrackr: Convex Migration Status

**Generated:** 2026-03-07  
**Scope:** Flask → Convex backend migration audit

---

## Overview

The app is migrating from a Flask/Supabase backend to Convex. The migration uses a
`MigrationSource = 'legacy-flask' | 'convex'` tag (defined in `frontend/src/lib/convex/contracts.ts`)
to track the origin of records in Convex. Migration is **partial** — only chat session
management has been moved to Convex so far. All other features still hit Flask exclusively.

The sole Convex module is `convex/chat.ts`. The frontend's `convex/api.ts` declares
function references for two additional namespaces (`profile:*` and `evaluations:*`)
that **do not yet exist** in the `convex/` folder.

---

## Current State Table

| Feature Area | Endpoint(s) | Backend | Status |
|---|---|---|---|
| **Chat – explore messages** | `POST /chat/explore`, `/chat/explore/stream` | Flask (AI) + Convex (storage) | ⚠️ Dual-path: Flask generates AI reply, Convex stores session via `syncCurrentChatSessionFromLegacy` |
| **Chat – explore sessions** | `GET /chat/sessions`, `DELETE /chat/sessions[/<id>]` | Convex | ✅ Migrated — frontend uses `chat:listCurrentUserSessions`, `deleteSession`, `clearExploreSessions` |
| **Chat – session history** | `GET /chat/history/<id>` | Convex | ✅ Migrated — frontend uses `chat:getSessionMessages` |
| **Chat – onboarding flow** | `POST /chat/onboarding`, `/chat/onboarding/stream` | Flask (AI) + Convex (state) | ⚠️ Dual-path: AI still on Flask; `getCurrentOnboardingFlowState`, `saveCurrentOnboardingFlow` in Convex |
| **Program evaluation – upload** | `POST /program-evaluations` | Flask (file + parse) + Convex (sync) | ⚠️ Dual-path: `evaluationHelpers.ts` uploads to Flask then calls `evaluations:replaceCurrentProgramEvaluationFromUpload` to sync |
| **Program evaluation – read** | `GET /program-evaluations/parsed` | Convex (primary) / Flask (fallback hydration) | ⚠️ Dual-path: `ProgressPage.tsx` queries `evaluations:getCurrentProgramEvaluation` first, falls back to `evaluations:hydrateCurrentProgramEvaluationFromLegacy` |
| **Program evaluation – delete** | `DELETE /program-evaluations` | Flask + Convex | ⚠️ Dual-path: `deleteCurrentProgramEvaluationBoundary` deletes from Flask storage then calls `evaluations:clearCurrentProgramEvaluation` |
| **User preferences** | `GET /auth/preferences`, `POST /auth/preferences` | Flask | 🔴 Legacy only — `OnboardingChat.tsx` posts onboarding answers directly to `/api/auth/preferences`; Convex `profile:*` functions not yet implemented |
| **Scheduling preferences** | `GET /auth/scheduling-preferences`, `PATCH /auth/scheduling-preferences` | Flask | 🔴 Legacy only — `profile:getCurrentSchedulingPreferences`, `profile:updateCurrentSchedulingPreferences` referenced in `convex/api.ts` but unimplemented |
| **Upcoming classes** | `GET /classes/upcoming` | Flask | 🔴 Legacy only — `ExploreClassesSidebar.tsx` fetches directly from `/api/classes/upcoming` |
| **Schedule builder – class search** | `GET /schedule/classes[/<id>]` | Flask | 🔴 Legacy only |
| **Schedule builder – validate** | `POST /schedule/validate` | Flask | 🔴 Legacy only |
| **Schedule builder – auto-generate** | `POST /schedule/generate` | Flask | 🔴 Legacy only |
| **Schedule builder – requirements** | `GET /schedule/user-requirements`, `/schedule/subjects`, `/schedule/stats` | Flask | 🔴 Legacy only |
| **Schedule snapshots** | `POST/GET/DELETE/PATCH /schedule/snapshots[/<id>]` | Flask | 🔴 Legacy only — `contracts.ts` defines `ScheduleSnapshotRecord` with `migrationSource`, indicating Convex migration is planned |
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
| POST | `/schedule/snapshots` | Save schedule snapshot |
| GET | `/schedule/snapshots` | List saved snapshots |
| GET | `/schedule/snapshots/<id>` | Get single snapshot |
| DELETE | `/schedule/snapshots/<id>` | Delete snapshot |
| PATCH | `/schedule/snapshots/<id>` | Update snapshot |

---

## Convex Functions (Implemented)

Only `convex/chat.ts` exists. It provides:

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

### Missing Convex Modules (referenced but not implemented)

| Module | Expected path | Frontend references |
|---|---|---|
| `legacyHydration` | `convex/legacyHydration.ts` | Imported by `convex/chat.ts` — **import will fail if deployed** |
| `userState` | `convex/userState.ts` | Imported by `convex/chat.ts` — **import will fail if deployed** |
| `profile` | `convex/profile.ts` | All `profile:*` in `convex/api.ts` (9 functions) |
| `evaluations` | `convex/evaluations.ts` | All `evaluations:*` in `convex/api.ts` (5 functions) |

> **Note:** `convex/chat.ts` depends on `./legacyHydration` and `./userState`. These files are not
> in the repository. The deployment either vendors them externally or they need to be created before
> `chat.ts` can be pushed.

---

## Recommended Next Migration Target

### 🎯 Priority 1: `profile` namespace — User Preferences & Scheduling Preferences

**Why first:**
- The frontend API layer is **already wired up** — `convex/api.ts` declares all 9 `profile:*` function
  references, and `profileHelpers.ts` has `syncCurrentUserPreferencesFromLegacy` / `syncCurrentSchedulingPreferencesFromLegacy` ready.
- `OnboardingChat.tsx` currently hits Flask at `POST /auth/preferences` to complete onboarding.
  This is the **core user journey** touchpoint — migrating it moves the most traffic.
- Enables the `profile:completeCurrentOnboarding` mutation to atomically save both user prefs and scheduling prefs in one Convex write (replacing two separate Flask calls today).
- Low risk: preferences are lightweight data (no file handling, no LLM calls).
- **Estimated Convex functions needed:** `convex/profile.ts` with ~9 functions (queries + mutations + one hydration action).

### 🥈 Priority 2: `evaluations` namespace — Program Evaluation Read/Sync

**Why second:**
- The dual-path pattern is **already partially in place**: `ProgressPage.tsx` queries
  `evaluations:getCurrentProgramEvaluation` first and falls back to Flask hydration.
- `evaluationHelpers.ts` already handles the upload-to-Flask-then-sync-to-Convex path.
- Completing this namespace means the progress page becomes fully Convex-backed with no Flask
  fallback for reads.
- **Estimated Convex functions needed:** `convex/evaluations.ts` with ~5 functions.

### 🥉 Priority 3: Schedule Snapshots

**Why third:**
- `contracts.ts` defines `ScheduleSnapshotRecord` with `migrationSource: MigrationSource`,
  signaling intent to migrate.
- Snapshots are self-contained (no AI, no file storage) — easiest part of the schedule domain.
- Does not require migrating the heavy schedule-generation or class-catalog logic.
- Unblocks removing the Supabase dependency from the schedule feature.

### 🔚 Leave for last: Schedule Builder (class search, validation, generation)
- Depends on local CSV data files and a degree-requirements matching engine in Python.
- The AI-assisted schedule generator (`schedule_generator.py`) is tightly coupled to Python services.
- No Convex infrastructure exists for this domain. Low priority until the data layer is decoupled.

---

## Blockers & Risks

| # | Blocker / Risk | Severity | Notes |
|---|---|---|---|
| 1 | `convex/legacyHydration.ts` missing | 🔴 Critical | `chat.ts` will fail to deploy without it. Must be created before Convex deployment. |
| 2 | `convex/userState.ts` missing | 🔴 Critical | Same as above — imported by `chat.ts`. |
| 3 | `profile.*` functions unimplemented | 🟠 High | Frontend already calls them; will silently fail until implemented. |
| 4 | `evaluations.*` functions unimplemented | 🟠 High | `ProgressPage.tsx` calls `evaluations:getCurrentProgramEvaluation` — returns nothing until implemented. |
| 5 | Convex URL not configured | 🟡 Medium | `VITE_CONVEX_URL` must be set for the client to activate. If absent, all Convex calls are no-ops. |
| 6 | Auth is still Flask-issued JWTs | 🟡 Medium | Convex is using Clerk tokens (via `useAuth` hook) for identity. The Flask token (`degreetrackr.auth.jwt`) and Convex auth are parallel systems. Full auth migration requires reconciling this. |
| 7 | Supabase still required | 🟡 Medium | User records, preferences, evaluations metadata, snapshots, and chat history all still live in Supabase. Convex currently mirrors data from Supabase. Full migration requires a data cut-over plan. |
| 8 | Program evaluation PDF storage | 🟡 Medium | Files are in Supabase Storage. Convex migration of evaluations will require either keeping Supabase Storage or moving to Convex file storage. |
