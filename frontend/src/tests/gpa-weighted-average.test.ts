import { describe, expect, it } from 'vitest'
import { calculateGPA } from '../lib/progressUtils'
import type { Course } from '../components/progress/ProgressPage'

function course(overrides: Partial<Course> & { credits: number; grade?: string | null }): Course {
  return { subject: 'GEN', number: '100', ...overrides }
}

describe('calculateGPA weighted average — DT145', () => {
  it('CS (4cr, A) + MATH (3cr, B) → weighted ≈ 3.571', () => {
    const courses: Course[] = [
      course({ subject: 'CS', number: '101', credits: 4, grade: 'A' }),
      course({ subject: 'MATH', number: '201', credits: 3, grade: 'B' }),
    ]
    // (4*4.0 + 3*3.0) / 7 = 25/7 ≈ 3.5714
    expect(calculateGPA(courses)).toBeCloseTo(25 / 7, 3)
  })

  it('all F grades → GPA = 0.0', () => {
    const courses: Course[] = [
      course({ subject: 'ENG', number: '100', credits: 3, grade: 'F' }),
      course({ subject: 'HIST', number: '100', credits: 4, grade: 'F' }),
    ]
    expect(calculateGPA(courses)).toBe(0.0)
  })

  it('single course → GPA equals that grade value', () => {
    const courses: Course[] = [
      course({ subject: 'BIO', number: '101', credits: 3, grade: 'B+' }),
    ]
    expect(calculateGPA(courses)).toBeCloseTo(3.3, 5)
  })

  it('zero-credit course is excluded from weighted average', () => {
    const courses: Course[] = [
      course({ subject: 'CS', number: '101', credits: 4, grade: 'A' }),
      course({ subject: 'SEM', number: '001', credits: 0, grade: 'B' }),
    ]
    // 0-credit course contributes 0 to both numerator and denominator
    // GPA = (4*4.0 + 0*3.0) / (4+0) = 16/4 = 4.0
    expect(calculateGPA(courses)).toBe(4.0)
  })

  it('all A grades → GPA = 4.0 regardless of credit count', () => {
    const courses: Course[] = [
      course({ subject: 'CS', number: '101', credits: 1, grade: 'A' }),
      course({ subject: 'MATH', number: '201', credits: 5, grade: 'A' }),
      course({ subject: 'ENG', number: '301', credits: 3, grade: 'A' }),
    ]
    expect(calculateGPA(courses)).toBe(4.0)
  })
})
