import { describe, expect, it } from 'vitest'
import { calculateProfileCompletion } from '../lib/profileCompletion'

describe('Profile completion percentage — DT149', () => {
  it('fresh profile (no fields filled) → 0%', () => {
    expect(calculateProfileCompletion({})).toBe(0)
  })

  it('fill in major → 33%', () => {
    expect(calculateProfileCompletion({ major: 'Computer Science' })).toBe(33)
  })

  it('fill in major + GPA → 67%', () => {
    expect(calculateProfileCompletion({ major: 'Computer Science', gpa: 3.5 })).toBe(67)
  })

  it('all fields filled → 100%', () => {
    expect(calculateProfileCompletion({
      major: 'Computer Science',
      gpa: 3.5,
      completedCourses: ['CS101'],
    })).toBe(100)
  })

  it('null/undefined fields treated as unfilled (not crash)', () => {
    expect(calculateProfileCompletion({ major: null, gpa: undefined, completedCourses: null })).toBe(0)
    // empty array also counts as unfilled
    expect(calculateProfileCompletion({ major: 'CS', gpa: 3.0, completedCourses: [] })).toBe(67)
  })
})
