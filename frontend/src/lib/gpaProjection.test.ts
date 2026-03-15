// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { projectGpa, type GradedCourse, type FutureCourse } from './gpaProjection'

describe('projectGpa', () => {
  it('returns 0 for empty current and future arrays', () => {
    expect(projectGpa([], [])).toBe(0.0)
  })

  it('returns current GPA when no future courses', () => {
    const current: GradedCourse[] = [
      { grade: 'A', credits: 3 },
      { grade: 'B', credits: 3 },
    ]
    // (4.0*3 + 3.0*3) / 6 = 21/6 = 3.5
    expect(projectGpa(current, [])).toBeCloseTo(3.5, 4)
  })

  it('returns projected GPA when no current courses', () => {
    const future: FutureCourse[] = [{ expectedGrade: 'A', credits: 3 }]
    expect(projectGpa([], future)).toBeCloseTo(4.0, 4)
  })

  it('combines current and future courses correctly', () => {
    const current: GradedCourse[] = [{ grade: 'B', credits: 3 }]   // 3.0 * 3 = 9.0
    const future: FutureCourse[] = [{ expectedGrade: 'A', credits: 3 }] // 4.0 * 3 = 12.0
    // (9.0 + 12.0) / 6 = 21/6 = 3.5
    expect(projectGpa(current, future)).toBeCloseTo(3.5, 4)
  })

  it('weighted GPA accounts for credit hours', () => {
    const current: GradedCourse[] = [
      { grade: 'A', credits: 4 },  // 4.0 * 4 = 16
      { grade: 'C', credits: 2 },  // 2.0 * 2 = 4
    ]
    // (16 + 4) / 6 = 3.333...
    expect(projectGpa(current, [])).toBeCloseTo(20 / 6, 4)
  })

  it('skips courses with unknown grade', () => {
    const current: GradedCourse[] = [
      { grade: 'A', credits: 3 },
      { grade: 'UNKNOWN', credits: 3 },
    ]
    // only A counts: 4.0
    expect(projectGpa(current, [])).toBeCloseTo(4.0, 4)
  })

  it('handles F grade correctly (0.0 points)', () => {
    const current: GradedCourse[] = [{ grade: 'F', credits: 3 }]
    expect(projectGpa(current, [])).toBe(0.0)
  })

  it('handles A- and B+ grades', () => {
    const current: GradedCourse[] = [
      { grade: 'A-', credits: 3 },  // 3.7 * 3 = 11.1
      { grade: 'B+', credits: 3 },  // 3.3 * 3 = 9.9
    ]
    // (11.1 + 9.9) / 6 = 3.5
    expect(projectGpa(current, [])).toBeCloseTo(3.5, 3)
  })

  it('returns 0 when all grades are unknown', () => {
    const current: GradedCourse[] = [{ grade: 'IP', credits: 3 }]
    expect(projectGpa(current, [])).toBe(0.0)
  })

  it('handles all-A perfect GPA', () => {
    const current: GradedCourse[] = Array.from({ length: 10 }, () => ({ grade: 'A', credits: 3 }))
    expect(projectGpa(current, [])).toBeCloseTo(4.0, 4)
  })
})
