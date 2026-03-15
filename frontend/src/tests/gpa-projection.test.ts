import { describe, expect, it } from 'vitest'
import { projectGpa } from '../lib/gpaProjection'

describe('GPA projection — DT164', () => {
  it('3 current B (3.0) + 1 future A (4.0) → projected = 3.25', () => {
    const current = [
      { grade: 'B', credits: 3 },
      { grade: 'B', credits: 3 },
      { grade: 'B', credits: 3 },
    ]
    const future = [{ expectedGrade: 'A', credits: 3 }]
    // (9+9+9 + 12) / 12 = 39/12 = 3.25
    expect(projectGpa(current, future)).toBeCloseTo(3.25, 4)
  })

  it('all current A (4.0) → projected = 4.0', () => {
    const current = [
      { grade: 'A', credits: 3 },
      { grade: 'A', credits: 4 },
    ]
    expect(projectGpa(current, [])).toBe(4.0)
  })

  it('0 future courses → projection = current GPA unchanged', () => {
    const current = [
      { grade: 'A', credits: 3 },
      { grade: 'C', credits: 3 },
    ]
    // (12 + 6) / 6 = 3.0
    expect(projectGpa(current, [])).toBeCloseTo(3.0, 4)
  })

  it('0 current courses + 3 future A → projected = 4.0', () => {
    const future = [
      { expectedGrade: 'A', credits: 3 },
      { expectedGrade: 'A', credits: 3 },
      { expectedGrade: 'A', credits: 3 },
    ]
    expect(projectGpa([], future)).toBe(4.0)
  })

  it('mix of all grades → weighted average correct', () => {
    const current = [
      { grade: 'A', credits: 4 },  // 4.0 × 4 = 16
      { grade: 'C', credits: 3 },  // 2.0 × 3 = 6
    ]
    const future = [
      { expectedGrade: 'B', credits: 3 },  // 3.0 × 3 = 9
      { expectedGrade: 'F', credits: 2 },  // 0.0 × 2 = 0
    ]
    // (16 + 6 + 9 + 0) / (4 + 3 + 3 + 2) = 31/12 ≈ 2.5833
    expect(projectGpa(current, future)).toBeCloseTo(31 / 12, 4)
  })
})
