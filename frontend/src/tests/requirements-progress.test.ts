import { describe, it, expect } from 'vitest'
import { calculateOverallProgress } from '../lib/progressUtils'

describe('Requirements progress bar accuracy', () => {
  it('returns 0% when 0 of 5 requirements completed', () => {
    expect(calculateOverallProgress(0, 5)).toBe(0)
  })

  it('returns 60% when 3 of 5 requirements completed', () => {
    expect(calculateOverallProgress(3, 5)).toBe(60)
  })

  it('returns 100% when 5 of 5 requirements completed', () => {
    expect(calculateOverallProgress(5, 5)).toBe(100)
  })

  it('returns 0% when total requirements is 0 (no divide by zero)', () => {
    expect(calculateOverallProgress(0, 0)).toBe(0)
  })

  it('returns 50% when 3 of 6 requirements completed (added 1 more)', () => {
    expect(calculateOverallProgress(3, 6)).toBe(50)
  })
})
