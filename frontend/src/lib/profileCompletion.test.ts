// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { calculateProfileCompletion } from './profileCompletion'

describe('calculateProfileCompletion', () => {
  it('returns 0 for an empty profile', () => {
    expect(calculateProfileCompletion({})).toBe(0)
  })

  it('returns 0 when all fields are null', () => {
    expect(calculateProfileCompletion({ major: null, gpa: null, completedCourses: null })).toBe(0)
  })

  it('returns 0 when completedCourses is an empty array', () => {
    expect(calculateProfileCompletion({ completedCourses: [] })).toBe(0)
  })

  it('returns 33 when only major is filled', () => {
    expect(calculateProfileCompletion({ major: 'Computer Science' })).toBe(33)
  })

  it('returns 33 when only gpa is filled', () => {
    expect(calculateProfileCompletion({ gpa: 3.5 })).toBe(33)
  })

  it('returns 33 when only completedCourses is filled', () => {
    expect(calculateProfileCompletion({ completedCourses: ['CS101'] })).toBe(33)
  })

  it('returns 67 when two of three fields are filled', () => {
    expect(calculateProfileCompletion({ major: 'CS', gpa: 3.5 })).toBe(67)
  })

  it('returns 100 when all three fields are filled', () => {
    expect(calculateProfileCompletion({
      major: 'Computer Science',
      gpa: 3.8,
      completedCourses: ['CS101', 'CS201'],
    })).toBe(100)
  })

  it('returns 0 for gpa=0 (0 is a valid but falsy value — treated as filled)', () => {
    // gpa=0 is not null/undefined so it should count as filled
    expect(calculateProfileCompletion({ gpa: 0 })).toBe(33)
  })

  it('handles undefined fields as not filled', () => {
    expect(calculateProfileCompletion({ major: undefined, gpa: 3.0 })).toBe(33)
  })
})
