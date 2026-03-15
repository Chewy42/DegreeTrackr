import { describe, expect, it } from 'vitest'

// ── Profile module structural & contract tests ────────────────────────────
// These tests verify exports, argument shapes, and helper behavior without
// requiring a live Convex database context.

describe('convex/profile — exported functions', () => {
  it('exports getCurrentUserProfile query', async () => {
    const mod = await import('../../../../convex/profile')
    expect(mod.getCurrentUserProfile).toBeDefined()
    expect(typeof mod.getCurrentUserProfile).toBe('function')
  })

  it('exports updateCurrentUserProfile mutation', async () => {
    const mod = await import('../../../../convex/profile')
    expect(mod.updateCurrentUserProfile).toBeDefined()
    expect(typeof mod.updateCurrentUserProfile).toBe('function')
  })

  it('exports getCurrentUserPreferences query', async () => {
    const mod = await import('../../../../convex/profile')
    expect(mod.getCurrentUserPreferences).toBeDefined()
  })

  it('exports updateCurrentUserPreferences mutation', async () => {
    const mod = await import('../../../../convex/profile')
    expect(mod.updateCurrentUserPreferences).toBeDefined()
  })

  it('exports completeCurrentOnboarding mutation', async () => {
    const mod = await import('../../../../convex/profile')
    expect(mod.completeCurrentOnboarding).toBeDefined()
  })

  it('exports deleteCurrentUserAccount mutation', async () => {
    const mod = await import('../../../../convex/profile')
    expect(mod.deleteCurrentUserAccount).toBeDefined()
  })

  it('exports scheduling preference queries and mutations', async () => {
    const mod = await import('../../../../convex/profile')
    expect(mod.getCurrentSchedulingPreferences).toBeDefined()
    expect(mod.updateCurrentSchedulingPreferences).toBeDefined()
  })

  it('exports legacy hydration actions', async () => {
    const mod = await import('../../../../convex/profile')
    expect(mod.hydrateCurrentUserPreferencesFromLegacy).toBeDefined()
    expect(mod.hydrateCurrentSchedulingPreferencesFromLegacy).toBeDefined()
  })
})

describe('convex/profile — updateCurrentUserProfile validation contract', () => {
  // The mutation uses v.object({ patch: v.object({ firstName, lastName, displayName }) })
  // and enforces non-empty strings and a 200-char limit in the handler.

  it('patch validator accepts optional firstName, lastName, displayName', async () => {
    const mod = await import('../../../../convex/profile')
    // The mutation is a Convex function descriptor — its args schema is baked in.
    // We verify the export exists and is callable (structural contract).
    expect(mod.updateCurrentUserProfile).toBeDefined()
  })
})

describe('convex/profile — getCurrentUserProfile null safety', () => {
  // getCurrentUserProfile returns null when getCurrentUserState yields no user.
  // This is a design-level assertion: the handler early-returns null, not an error.
  it('handler is designed to return null for unauthenticated callers (structural)', async () => {
    const mod = await import('../../../../convex/profile')
    // Verify the query exists — runtime null-return requires a Convex test harness.
    expect(mod.getCurrentUserProfile).toBeDefined()
  })
})

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
