import { describe, expect, it } from 'vitest'
import { getCurrentSemester } from '../lib/academicCalendar'

describe('Academic calendar auto-detection — DT156', () => {
  it('January 15 → Spring <year>', () => {
    const result = getCurrentSemester(new Date(2026, 0, 15))
    expect(result).toBe('Spring 2026')
  })

  it('September 10 → Fall <year>', () => {
    const result = getCurrentSemester(new Date(2026, 8, 10))
    expect(result).toBe('Fall 2026')
  })

  it('June 1 → Summer <year>', () => {
    const result = getCurrentSemester(new Date(2026, 5, 1))
    expect(result).toBe('Summer 2026')
  })

  it('December 31 → Fall <year>', () => {
    const result = getCurrentSemester(new Date(2026, 11, 31))
    expect(result).toBe('Fall 2026')
  })
})
