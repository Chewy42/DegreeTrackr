import { describe, expect, it } from 'vitest'
import {
  deduplicateCourses,
  findPrimaryRequirement,
  calculateOverallProgress,
} from './progressUtils'
import type { Course, CreditRequirement } from '../components/progress/ProgressPage'

// ── deduplicateCourses ──────────────────────────────────────────────────────

describe('deduplicateCourses', () => {
  it('keeps only the best grade when a course appears twice (retake)', () => {
    const courses: Course[] = [
      { subject: 'MATH', number: '101', title: 'Calculus I', grade: 'C', credits: 4, term: 'Fall 2023' },
      { subject: 'MATH', number: '101', title: 'Calculus I', grade: 'A', credits: 4, term: 'Spring 2024' },
    ]

    const result = deduplicateCourses(courses)

    expect(result).toHaveLength(1)
    expect(result[0]?.grade).toBe('A')
  })

  it('keeps one copy when same course appears three times', () => {
    const courses: Course[] = [
      { subject: 'ENG', number: '100', title: 'English', grade: 'D', credits: 3 },
      { subject: 'ENG', number: '100', title: 'English', grade: 'B', credits: 3 },
      { subject: 'ENG', number: '100', title: 'English', grade: 'C+', credits: 3 },
    ]

    const result = deduplicateCourses(courses)

    expect(result).toHaveLength(1)
    expect(result[0]?.grade).toBe('B')
  })

  it('does not deduplicate courses with different numbers', () => {
    const courses: Course[] = [
      { subject: 'MATH', number: '101', title: 'Calculus I', grade: 'B', credits: 4 },
      { subject: 'MATH', number: '102', title: 'Calculus II', grade: 'A', credits: 4 },
    ]

    const result = deduplicateCourses(courses)
    expect(result).toHaveLength(2)
  })

  it('preserves courses without subject or number (ungroupable)', () => {
    const courses: Course[] = [
      { subject: 'MATH', number: '101', grade: 'B', credits: 4 },
      { credits: 3, title: 'Transfer Credit' },
      { subject: 'MATH', number: '101', grade: 'A', credits: 4 },
    ]

    const result = deduplicateCourses(courses)

    expect(result).toHaveLength(2) // deduped MATH 101 + ungroupable transfer
    expect(result.find((c) => c.subject === 'MATH')?.grade).toBe('A')
    expect(result.find((c) => !c.subject)).toBeTruthy()
  })

  it('returns empty array for empty input', () => {
    expect(deduplicateCourses([])).toHaveLength(0)
  })

  it('prefers graded course over ungraded duplicate', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '200', grade: null, credits: 3 },
      { subject: 'CS', number: '200', grade: 'B+', credits: 3 },
    ]

    const result = deduplicateCourses(courses)
    expect(result).toHaveLength(1)
    expect(result[0]?.grade).toBe('B+')
  })
})

// ── findPrimaryRequirement ──────────────────────────────────────────────────

describe('findPrimaryRequirement', () => {
  it('prefers requirement with "degree credit" in label', () => {
    const reqs: CreditRequirement[] = [
      { label: 'Upper Division', required: 48, earned: 30, in_progress: 3, needed: 15 },
      { label: 'Degree credit requirement', required: 120, earned: 90, in_progress: 6, needed: 24 },
      { label: 'Residency', required: 30, earned: 30, in_progress: 0, needed: 0 },
    ]

    const primary = findPrimaryRequirement(reqs)
    expect(primary?.label).toBe('Degree credit requirement')
  })

  it('falls back to largest required when no "degree credit" label exists', () => {
    const reqs: CreditRequirement[] = [
      { label: 'General Education', required: 48, earned: 48, in_progress: 0, needed: 0 },
      { label: 'Total Credits', required: 120, earned: 80, in_progress: 12, needed: 28 },
      { label: 'Major Core', required: 36, earned: 24, in_progress: 3, needed: 9 },
    ]

    const primary = findPrimaryRequirement(reqs)
    expect(primary?.label).toBe('Total Credits')
  })

  it('returns undefined for empty requirements', () => {
    expect(findPrimaryRequirement([])).toBeUndefined()
  })
})

// ── calculateOverallProgress ────────────────────────────────────────────────

describe('calculateOverallProgress', () => {
  it('caps at 100% when earned exceeds required (over-requirement)', () => {
    // 140 earned out of 120 required → should be 100%, not 117%
    expect(calculateOverallProgress(140, 120)).toBe(100)
  })

  it('returns 0% when required is 0 (empty state)', () => {
    expect(calculateOverallProgress(0, 0)).toBe(0)
  })

  it('returns 0% when required is negative', () => {
    expect(calculateOverallProgress(10, -5)).toBe(0)
  })

  it('returns 0% when no credits earned', () => {
    expect(calculateOverallProgress(0, 120)).toBe(0)
  })

  it('returns exact percentage for normal progress', () => {
    // 60/120 = 50%
    expect(calculateOverallProgress(60, 120)).toBe(50)
  })

  it('rounds correctly', () => {
    // 90/120 = 75%
    expect(calculateOverallProgress(90, 120)).toBe(75)
    // 1/3 ≈ 33.33% → rounds to 33%
    expect(calculateOverallProgress(40, 120)).toBe(33)
  })

  it('returns exactly 100% when earned equals required', () => {
    expect(calculateOverallProgress(120, 120)).toBe(100)
  })
})

// ── Transfer credits integration ────────────────────────────────────────────

describe('transfer credits in requirements', () => {
  it('transfer credits counted in earned total are reflected in progress', () => {
    // Scenario: student has 60 classroom credits + 30 transfer credits = 90 earned
    // The PDF parser includes transfer credits in the earned total of credit_requirements.
    const reqs: CreditRequirement[] = [
      { label: 'Degree credit requirement', required: 120, earned: 90, in_progress: 0, needed: 30 },
    ]

    const primary = findPrimaryRequirement(reqs)
    expect(primary).toBeDefined()

    const progress = calculateOverallProgress(primary!.earned, primary!.required)
    expect(progress).toBe(75) // 90/120 = 75%
  })
})

// ── Empty state ─────────────────────────────────────────────────────────────

describe('empty state', () => {
  it('all requirements show 0% with no completed courses', () => {
    const reqs: CreditRequirement[] = [
      { label: 'Degree credit requirement', required: 120, earned: 0, in_progress: 0, needed: 120 },
      { label: 'Major Core', required: 36, earned: 0, in_progress: 0, needed: 36 },
    ]

    for (const req of reqs) {
      expect(calculateOverallProgress(req.earned, req.required)).toBe(0)
    }
  })

  it('deduplicating empty course list returns empty safely', () => {
    expect(deduplicateCourses([])).toEqual([])
  })

  it('findPrimaryRequirement on empty returns undefined', () => {
    expect(findPrimaryRequirement([])).toBeUndefined()
  })
})
