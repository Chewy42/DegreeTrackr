import { describe, expect, it } from 'vitest'
import { calculateGPA, gradeValue } from './progressUtils'
import type { Course } from '../components/progress/ProgressPage'

// ── gradeValue mapping ──────────────────────────────────────────────────────

describe('gradeValue', () => {
  it('maps A+/A/A- to correct GPA points', () => {
    expect(gradeValue('A+')).toBe(4.0)
    expect(gradeValue('A')).toBe(4.0)
    expect(gradeValue('A-')).toBe(3.7)
  })

  it('maps B range correctly', () => {
    expect(gradeValue('B+')).toBe(3.3)
    expect(gradeValue('B')).toBe(3.0)
    expect(gradeValue('B-')).toBe(2.7)
  })

  it('maps C range correctly', () => {
    expect(gradeValue('C+')).toBe(2.3)
    expect(gradeValue('C')).toBe(2.0)
    expect(gradeValue('C-')).toBe(1.7)
  })

  it('maps D range correctly', () => {
    expect(gradeValue('D+')).toBe(1.3)
    expect(gradeValue('D')).toBe(1.0)
    expect(gradeValue('D-')).toBe(0.7)
  })

  it('maps F to 0.0', () => {
    expect(gradeValue('F')).toBe(0.0)
  })

  it('returns -1 for null/undefined/unknown grades', () => {
    expect(gradeValue(null)).toBe(-1)
    expect(gradeValue(undefined)).toBe(-1)
    expect(gradeValue('P')).toBe(-1)
    expect(gradeValue('XYZ')).toBe(-1)
  })
})

// ── calculateGPA ────────────────────────────────────────────────────────────

describe('calculateGPA', () => {
  it('returns 4.0 for a single A', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '101', grade: 'A', credits: 3 },
    ]
    expect(calculateGPA(courses)).toBe(4.0)
  })

  it('returns 0.0 for empty transcript (not NaN)', () => {
    expect(calculateGPA([])).toBe(0.0)
    expect(Number.isNaN(calculateGPA([]))).toBe(false)
  })

  it('calculates weighted GPA across multiple courses', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '101', grade: 'A', credits: 3 },   // 4.0 × 3 = 12
      { subject: 'MATH', number: '201', grade: 'B', credits: 4 }, // 3.0 × 4 = 12
    ]
    // (12 + 12) / (3 + 4) = 24/7 ≈ 3.4286
    expect(calculateGPA(courses)).toBeCloseTo(24 / 7, 4)
  })

  it('excludes Pass/Fail courses from GPA', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '101', grade: 'A', credits: 3 },
      { subject: 'PE', number: '100', grade: 'P', credits: 1 },
    ]
    // P course excluded → GPA = 4.0
    expect(calculateGPA(courses)).toBe(4.0)
  })

  it('excludes NP, S, U, W, I, CR, NC, AU grades from GPA', () => {
    const excluded = ['NP', 'S', 'U', 'W', 'I', 'IP', 'CR', 'NC', 'AU']
    for (const grade of excluded) {
      const courses: Course[] = [
        { subject: 'CS', number: '101', grade: 'B', credits: 3 },
        { subject: 'X', number: '100', grade, credits: 2 },
      ]
      expect(calculateGPA(courses)).toBe(3.0)
    }
  })

  it('excludes in-progress courses (no grade yet)', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '101', grade: 'A', credits: 3 },
      { subject: 'CS', number: '301', grade: null, credits: 3 },
      { subject: 'CS', number: '302', credits: 3 },
    ]
    // Only the A counts → 4.0
    expect(calculateGPA(courses)).toBe(4.0)
  })

  it('handles repeated course: only best grade counts', () => {
    const courses: Course[] = [
      { subject: 'MATH', number: '101', grade: 'C', credits: 4, term: 'Fall 2023' },
      { subject: 'MATH', number: '101', grade: 'A', credits: 4, term: 'Spring 2024' },
    ]
    // Deduplication keeps A → GPA = 4.0
    expect(calculateGPA(courses)).toBe(4.0)
  })

  it('handles repeated course with three attempts', () => {
    const courses: Course[] = [
      { subject: 'ENG', number: '100', grade: 'D', credits: 3 },
      { subject: 'ENG', number: '100', grade: 'B', credits: 3 },
      { subject: 'ENG', number: '100', grade: 'C+', credits: 3 },
    ]
    // Best grade is B (3.0) → GPA = 3.0
    expect(calculateGPA(courses)).toBe(3.0)
  })

  it('returns 0.0 when all courses are Pass/Fail', () => {
    const courses: Course[] = [
      { subject: 'PE', number: '100', grade: 'P', credits: 1 },
      { subject: 'PE', number: '200', grade: 'P', credits: 1 },
    ]
    expect(calculateGPA(courses)).toBe(0.0)
    expect(Number.isNaN(calculateGPA(courses))).toBe(false)
  })

  it('returns 0.0 when all courses are in-progress', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '400', grade: null, credits: 3 },
      { subject: 'CS', number: '401', credits: 3 },
    ]
    expect(calculateGPA(courses)).toBe(0.0)
  })

  it('correctly weights credits in GPA calculation', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '101', grade: 'A', credits: 1 },   // 4.0 × 1 = 4
      { subject: 'MATH', number: '301', grade: 'C', credits: 4 }, // 2.0 × 4 = 8
    ]
    // (4 + 8) / (1 + 4) = 12/5 = 2.4
    expect(calculateGPA(courses)).toBeCloseTo(2.4, 4)
  })

  it('handles F grade as 0.0 points (still counted in GPA)', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '101', grade: 'A', credits: 3 },  // 4.0 × 3 = 12
      { subject: 'CS', number: '200', grade: 'F', credits: 3 },  // 0.0 × 3 = 0
    ]
    // (12 + 0) / (3 + 3) = 12/6 = 2.0
    expect(calculateGPA(courses)).toBe(2.0)
  })
})
