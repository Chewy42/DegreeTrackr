import { describe, expect, it } from 'vitest'
import { calculateGPA } from '../lib/progressUtils'
import type { Course } from '../components/progress/ProgressPage'

describe('GPA weighted average accuracy — DT145', () => {
  it('CS (4cr A) + MATH (3cr B) → weighted GPA ≈ 3.57', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '101', grade: 'A', credits: 4 },
      { subject: 'MATH', number: '201', grade: 'B', credits: 3 },
    ]
    // (4.0×4 + 3.0×3) / (4+3) = 25/7 ≈ 3.5714
    expect(calculateGPA(courses)).toBeCloseTo(25 / 7, 4)
  })

  it('all A grades → GPA = 4.0', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '101', grade: 'A', credits: 3 },
      { subject: 'MATH', number: '201', grade: 'A', credits: 4 },
      { subject: 'ENG', number: '100', grade: 'A', credits: 3 },
    ]
    expect(calculateGPA(courses)).toBe(4.0)
  })

  it('all F grades → GPA = 0.0', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '101', grade: 'F', credits: 3 },
      { subject: 'MATH', number: '201', grade: 'F', credits: 4 },
    ]
    expect(calculateGPA(courses)).toBe(0.0)
  })

  it('single course (3cr C) → GPA = 2.0', () => {
    const courses: Course[] = [
      { subject: 'HIST', number: '101', grade: 'C', credits: 3 },
    ]
    expect(calculateGPA(courses)).toBe(2.0)
  })

  it('zero credits total → returns 0 (no divide by zero)', () => {
    expect(calculateGPA([])).toBe(0.0)
    expect(Number.isNaN(calculateGPA([]))).toBe(false)

    // All excluded grades → also zero credits counted
    const courses: Course[] = [
      { subject: 'PE', number: '100', grade: 'P', credits: 1 },
      { subject: 'ART', number: '100', grade: 'W', credits: 3 },
    ]
    expect(calculateGPA(courses)).toBe(0.0)
    expect(Number.isNaN(calculateGPA(courses))).toBe(false)
  })
})
