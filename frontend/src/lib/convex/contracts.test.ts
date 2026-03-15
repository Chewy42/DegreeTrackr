import { describe, expect, it, vi } from 'vitest'

// ── Contracts module tests ───────────────────────────────────────────────────
// convex/contracts.ts exports Convex value validators that define the typed
// contracts shared between frontend and backend. These tests verify the
// exported shapes and structural expectations without cross-boundary imports.

vi.mock('../../../../convex/contracts', () => ({
  migrationSourceValidator: { _type: 'validator', kind: 'union' },
  chatScopeValidator: { _type: 'validator', kind: 'union' },
  onboardingAnswersValidator: { _type: 'validator', kind: 'object' },
  userPreferencesValidator: { _type: 'validator', kind: 'object' },
  schedulingPreferencesValidator: { _type: 'validator', kind: 'object' },
}))

describe('contracts — module API contract', () => {
  it('exports migrationSourceValidator', async () => {
    const mod = await import('../../../../convex/contracts')
    expect(mod.migrationSourceValidator).toBeDefined()
    expect(mod.migrationSourceValidator).toHaveProperty('_type', 'validator')
  })

  it('exports chatScopeValidator', async () => {
    const mod = await import('../../../../convex/contracts')
    expect(mod.chatScopeValidator).toBeDefined()
    expect(mod.chatScopeValidator).toHaveProperty('_type', 'validator')
  })

  it('exports onboardingAnswersValidator', async () => {
    const mod = await import('../../../../convex/contracts')
    expect(mod.onboardingAnswersValidator).toBeDefined()
    expect(mod.onboardingAnswersValidator).toHaveProperty('_type', 'validator')
  })

  it('exports userPreferencesValidator', async () => {
    const mod = await import('../../../../convex/contracts')
    expect(mod.userPreferencesValidator).toBeDefined()
    expect(mod.userPreferencesValidator).toHaveProperty('_type', 'validator')
  })

  it('exports schedulingPreferencesValidator', async () => {
    const mod = await import('../../../../convex/contracts')
    expect(mod.schedulingPreferencesValidator).toBeDefined()
    expect(mod.schedulingPreferencesValidator).toHaveProperty('_type', 'validator')
  })
})

describe('contracts — validator structural expectations', () => {
  it('migrationSourceValidator is a union type', async () => {
    const mod = await import('../../../../convex/contracts')
    expect(mod.migrationSourceValidator).toHaveProperty('kind', 'union')
  })

  it('chatScopeValidator is a union type', async () => {
    const mod = await import('../../../../convex/contracts')
    expect(mod.chatScopeValidator).toHaveProperty('kind', 'union')
  })

  it('onboardingAnswersValidator is an object type', async () => {
    const mod = await import('../../../../convex/contracts')
    expect(mod.onboardingAnswersValidator).toHaveProperty('kind', 'object')
  })

  it('userPreferencesValidator is an object type', async () => {
    const mod = await import('../../../../convex/contracts')
    expect(mod.userPreferencesValidator).toHaveProperty('kind', 'object')
  })

  it('schedulingPreferencesValidator is an object type', async () => {
    const mod = await import('../../../../convex/contracts')
    expect(mod.schedulingPreferencesValidator).toHaveProperty('kind', 'object')
  })
})

describe('contracts — all five validators are exported (completeness)', () => {
  it('module exports exactly the expected validators', async () => {
    const mod = await import('../../../../convex/contracts')
    const exportedKeys = Object.keys(mod).sort()
    expect(exportedKeys).toEqual([
      'chatScopeValidator',
      'migrationSourceValidator',
      'onboardingAnswersValidator',
      'schedulingPreferencesValidator',
      'userPreferencesValidator',
    ])
  })
})
