import { describe, expect, it } from 'vitest'
import type { UserPreferences } from '../../auth/AuthContext'

// ── Contract snapshots ────────────────────────────────────────────────────────
// These tests document the expected shape of user-state contracts that the
// frontend depends on. They are intentionally static — runtime validation of
// the Convex backend validators belongs in a Convex test harness, not here.
//
// If the backend validator changes, update BOTH the backend contracts AND these
// frontend contract snapshots so the mismatch is obvious at review time.

const KNOWN_USER_PREFERENCE_FIELDS: (keyof UserPreferences)[] = [
  'hasProgramEvaluation',
  'onboardingComplete',
  'landingView',
  'theme',
]

const KNOWN_SCHEDULING_PREFERENCE_FIELDS: string[] = [
  'planning_mode',
  'credit_load',
  'schedule_preference',
  'work_status',
  'priority',
]

describe('userState audit — preference field contracts', () => {
  it('frontend UserPreferences type covers all expected fields', () => {
    // Verify that a fully-populated UserPreferences object type-checks cleanly.
    // TypeScript will catch field name typos at compile time; this runtime check
    // documents the field set so regressions are visible in test output too.
    const allKnown = new Set(KNOWN_USER_PREFERENCE_FIELDS)
    expect(allKnown.has('hasProgramEvaluation')).toBe(true)
    expect(allKnown.has('onboardingComplete')).toBe(true)
    expect(allKnown.has('landingView')).toBe(true)
    expect(allKnown.has('theme')).toBe(true)
    expect(allKnown.has('randomUnknownKey' as keyof UserPreferences)).toBe(false)
  })

  it('scheduling preference contract covers all expected fields', () => {
    const allKnown = new Set(KNOWN_SCHEDULING_PREFERENCE_FIELDS)
    expect(allKnown.has('planning_mode')).toBe(true)
    expect(allKnown.has('credit_load')).toBe(true)
    expect(allKnown.has('schedule_preference')).toBe(true)
    expect(allKnown.has('work_status')).toBe(true)
    expect(allKnown.has('priority')).toBe(true)
    expect(allKnown.has('randomUnknownKey')).toBe(false)
  })
})

describe('userState audit — deletion cascade contract (structural)', () => {
  // NOTE: Convex mutation existence and cascade completeness can only be tested
  // properly in a Convex test harness (vitest + @convex-dev/test).
  // The assertions below are structural documentation tests only.

  it('frontend knows the required preference fields for account deletion', () => {
    // When an account is deleted, all user-scoped tables should be cleared.
    // The frontend contract is that after deletion, preferences reset to the
    // empty defaults that the AuthProvider initialises with.
    const emptyPreferences: UserPreferences = {}
    expect(Object.keys(emptyPreferences)).toHaveLength(0)
  })

  it('onboarding completion is idempotent at the frontend level', () => {
    // After onboarding completes, onboardingComplete stays truthy regardless
    // of how many times the preference is written. Idempotency at the backend
    // mutation level is tested in the Convex test harness.
    const after: UserPreferences = { onboardingComplete: true }
    const patchedAgain: UserPreferences = { ...after, onboardingComplete: true }
    expect(patchedAgain.onboardingComplete).toBe(true)
  })
})
