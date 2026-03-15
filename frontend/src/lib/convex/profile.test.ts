import { describe, expect, it } from 'vitest'

// ── Profile module tests ──────────────────────────────────────────────────────
// Backend Convex profile functions (getCurrentUserProfile, updateCurrentUserProfile,
// etc.) are tested in the Convex test harness — not here. The frontend vitest
// suite does not install root node_modules, so importing ../../../../convex/*
// directly is not supported in this test environment.

// ── profileHelpers ────────────────────────────────────────────────────────────

describe('profileHelpers — normalizeSchedulingPreferences', () => {
  it('returns empty object for null input', async () => {
    const { normalizeSchedulingPreferences } = await import('./profileHelpers')
    expect(normalizeSchedulingPreferences(null)).toEqual({})
  })

  it('returns empty object for undefined input', async () => {
    const { normalizeSchedulingPreferences } = await import('./profileHelpers')
    expect(normalizeSchedulingPreferences(undefined)).toEqual({})
  })

  it('strips undefined fields from a partial input', async () => {
    const { normalizeSchedulingPreferences } = await import('./profileHelpers')
    const result = normalizeSchedulingPreferences({
      planning_mode: 'upcoming_semester',
      credit_load: undefined,
    })
    expect(result).toEqual({ planning_mode: 'upcoming_semester' })
    expect(result).not.toHaveProperty('credit_load')
  })

  it('preserves all defined fields', async () => {
    const { normalizeSchedulingPreferences } = await import('./profileHelpers')
    const input = {
      planning_mode: 'four_year_plan' as const,
      credit_load: 'heavy' as const,
      schedule_preference: 'mornings' as const,
      work_status: 'part_time' as const,
      priority: 'major' as const,
    }
    expect(normalizeSchedulingPreferences(input)).toEqual(input)
  })
})
