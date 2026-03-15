// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { normalizeSchedulingPreferences } from './profileHelpers'

describe('normalizeSchedulingPreferences', () => {
  it('returns empty object for null input', () => {
    expect(normalizeSchedulingPreferences(null)).toEqual({})
  })

  it('returns empty object for undefined input', () => {
    expect(normalizeSchedulingPreferences(undefined)).toEqual({})
  })

  it('includes planning_mode when present', () => {
    const result = normalizeSchedulingPreferences({ planning_mode: 'four_year_plan' })
    expect(result.planning_mode).toBe('four_year_plan')
  })

  it('omits planning_mode when falsy', () => {
    const result = normalizeSchedulingPreferences({ planning_mode: '' })
    expect(result.planning_mode).toBeUndefined()
  })

  it('includes credit_load when present', () => {
    const result = normalizeSchedulingPreferences({ credit_load: 'standard' })
    expect(result.credit_load).toBe('standard')
  })

  it('includes multiple fields correctly', () => {
    const result = normalizeSchedulingPreferences({
      planning_mode: 'upcoming_semester',
      credit_load: 'light',
      priority: 'major',
    })
    expect(result.planning_mode).toBe('upcoming_semester')
    expect(result.credit_load).toBe('light')
    expect(result.priority).toBe('major')
  })

  it('omits fields with falsy values', () => {
    const result = normalizeSchedulingPreferences({
      planning_mode: '',
      credit_load: 'standard',
    })
    expect(result.planning_mode).toBeUndefined()
    expect(result.credit_load).toBe('standard')
  })
})
