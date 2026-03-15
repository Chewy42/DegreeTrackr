import { describe, expect, it } from 'vitest'

import {
  calculateGPA,
  calculateOverallProgress,
  deduplicateCourses,
  findPrimaryRequirement,
} from '../progressUtils'
import type { Course, CreditRequirement } from '../../components/progress/ProgressPage'

// ── Helper factories ──────────────────────────────────────────────────────────

function makeCourse(overrides: Partial<Course> & { credits: number }): Course {
  return {
    term: 'Fall 2024',
    subject: 'CS',
    number: '101',
    title: 'Intro to CS',
    grade: 'A',
    type: 'completed',
    ...overrides,
  }
}

function makeRequirement(overrides: Partial<CreditRequirement> & { label: string; required: number; earned: number }): CreditRequirement {
  const { label, required, earned, in_progress = 0 } = { in_progress: 0, ...overrides }
  return {
    label,
    required,
    earned,
    in_progress,
    needed: Math.max(0, required - earned - in_progress),
  }
}

/**
 * Simulate the degree audit classification step.
 *
 * Given a list of credit requirements (as would come from the backend's
 * parsed_data.credit_requirements field), classify each as:
 *   - 'completed'   → needed === 0
 *   - 'in_progress' → needed > 0 && in_progress > 0
 *   - 'incomplete'  → needed > 0 && in_progress === 0
 *
 * This mirrors the logic in RequirementsChecklist.tsx and DegreeProgressCard.tsx.
 */
type RequirementStatus = 'completed' | 'in_progress' | 'incomplete'

function classifyRequirement(req: CreditRequirement): RequirementStatus {
  if (req.needed === 0) return 'completed'
  if (req.in_progress > 0) return 'in_progress'
  return 'incomplete'
}

function classifyAllRequirements(
  requirements: CreditRequirement[],
): { req: CreditRequirement; status: RequirementStatus }[] {
  return requirements.map((req) => ({ req, status: classifyRequirement(req) }))
}

/**
 * Compute overall degree completion percentage from a list of requirements.
 * Uses the primary (degree-level) requirement's earned/required credits.
 * Falls back to counting completed categories if no primary is found.
 */
function computeOverallPercentage(requirements: CreditRequirement[]): number {
  const primary = findPrimaryRequirement(requirements)
  if (primary) {
    return calculateOverallProgress(primary.earned, primary.required)
  }
  if (requirements.length === 0) return 0
  const completedCount = requirements.filter((r) => r.needed === 0).length
  return calculateOverallProgress(completedCount, requirements.length)
}

// ── Fixed transcript (mock degree audit data) ─────────────────────────────────

/**
 * A representative transcript for a student 75 credits into a 120-credit degree.
 * Courses span multiple categories, including one retake.
 */
const PARTIAL_TRANSCRIPT: Course[] = [
  // Core / General Education (30 credits earned)
  makeCourse({ subject: 'ENG', number: '101', credits: 3, grade: 'B+', title: 'Composition I' }),
  makeCourse({ subject: 'ENG', number: '102', credits: 3, grade: 'A-', title: 'Composition II' }),
  makeCourse({ subject: 'MATH', number: '151', credits: 4, grade: 'A', title: 'Calculus I' }),
  makeCourse({ subject: 'MATH', number: '152', credits: 4, grade: 'B', title: 'Calculus II' }),
  makeCourse({ subject: 'HIST', number: '101', credits: 3, grade: 'A', title: 'World History' }),
  makeCourse({ subject: 'SCI', number: '110', credits: 4, grade: 'B+', title: 'Physics I' }),
  makeCourse({ subject: 'SCI', number: '111', credits: 4, grade: 'A-', title: 'Physics II' }),
  makeCourse({ subject: 'PSY', number: '101', credits: 3, grade: 'A', title: 'Intro Psychology' }),
  makeCourse({ subject: 'ART', number: '105', credits: 2, grade: 'A+', title: 'Art Appreciation' }),

  // Major requirements (30 credits earned, 1 retake)
  makeCourse({ subject: 'CS', number: '101', credits: 3, grade: 'C', title: 'Intro CS (retake)', term: 'Spring 2023' }),
  makeCourse({ subject: 'CS', number: '101', credits: 3, grade: 'B+', title: 'Intro CS', term: 'Fall 2023' }), // retake – best grade kept
  makeCourse({ subject: 'CS', number: '201', credits: 3, grade: 'A', title: 'Data Structures' }),
  makeCourse({ subject: 'CS', number: '301', credits: 3, grade: 'B', title: 'Algorithms' }),
  makeCourse({ subject: 'CS', number: '350', credits: 3, grade: 'A-', title: 'Operating Systems' }),
  makeCourse({ subject: 'CS', number: '401', credits: 3, grade: 'B+', title: 'Databases' }),
  makeCourse({ subject: 'CS', number: '410', credits: 3, grade: 'A', title: 'Networks' }),
  makeCourse({ subject: 'CS', number: '450', credits: 3, grade: 'A-', title: 'Software Engineering' }),
  makeCourse({ subject: 'CS', number: '460', credits: 3, grade: 'B', title: 'Machine Learning' }),
  makeCourse({ subject: 'CS', number: '470', credits: 3, grade: 'A', title: 'Computer Graphics' }),

  // Electives (15 credits earned)
  makeCourse({ subject: 'BUS', number: '200', credits: 3, grade: 'A', title: 'Business Fundamentals' }),
  makeCourse({ subject: 'BUS', number: '210', credits: 3, grade: 'B+', title: 'Marketing' }),
  makeCourse({ subject: 'STAT', number: '200', credits: 3, grade: 'A-', title: 'Statistics' }),
  makeCourse({ subject: 'PHIL', number: '101', credits: 3, grade: 'A', title: 'Ethics' }),
  makeCourse({ subject: 'COMM', number: '110', credits: 3, grade: 'B', title: 'Public Speaking' }),
]

/**
 * Credit requirements as the backend would return them for PARTIAL_TRANSCRIPT.
 * Student has earned 75 credits toward a 120-credit degree:
 *   - General Education: 30/30 ✅
 *   - Major Requirements: 27/45 (retake deduplicated to 9 unique CS courses × 3cr = 27)
 *   - Electives: 15/15 ✅
 *   - Total (Degree credit): 72/120 (earned excludes the retake duplicate)
 */
const PARTIAL_REQUIREMENTS: CreditRequirement[] = [
  makeRequirement({ label: 'Degree credit', required: 120, earned: 72, in_progress: 0 }),
  makeRequirement({ label: 'General Education', required: 30, earned: 30, in_progress: 0 }),
  makeRequirement({ label: 'Major Requirements', required: 45, earned: 27, in_progress: 0 }),
  makeRequirement({ label: 'Electives', required: 15, earned: 15, in_progress: 0 }),
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('degree audit report — full computation with fixed transcript', () => {
  describe('transcript deduplication', () => {
    it('deduplicates retaken courses, keeping best grade', () => {
      const deduped = deduplicateCourses(PARTIAL_TRANSCRIPT)
      const cs101Attempts = deduped.filter(
        (c) => c.subject === 'CS' && c.number === '101',
      )
      expect(cs101Attempts).toHaveLength(1)
      expect(cs101Attempts[0].grade).toBe('B+')
    })

    it('retains non-retaken courses unchanged', () => {
      const deduped = deduplicateCourses(PARTIAL_TRANSCRIPT)
      const cs201 = deduped.filter((c) => c.subject === 'CS' && c.number === '201')
      expect(cs201).toHaveLength(1)
    })

    it('deduped transcript has fewer entries than original when retakes exist', () => {
      const deduped = deduplicateCourses(PARTIAL_TRANSCRIPT)
      expect(deduped.length).toBeLessThan(PARTIAL_TRANSCRIPT.length)
      // One retake removed → original 25 courses → 24 after dedup
      expect(deduped.length).toBe(PARTIAL_TRANSCRIPT.length - 1)
    })
  })

  describe('GPA computation from transcript', () => {
    it('calculates a weighted GPA > 3.0 for the partial transcript', () => {
      const deduped = deduplicateCourses(PARTIAL_TRANSCRIPT)
      const gpa = calculateGPA(deduped)
      expect(gpa).toBeGreaterThan(3.0)
      expect(gpa).toBeLessThanOrEqual(4.0)
    })

    it('returns 0 for an empty transcript', () => {
      expect(calculateGPA([])).toBe(0.0)
    })

    it('correctly weights credit hours (4-credit course has more GPA impact)', () => {
      const heavyCourse = makeCourse({ subject: 'X', number: '1', credits: 4, grade: 'A' })
      const lightCourse = makeCourse({ subject: 'Y', number: '1', credits: 1, grade: 'C' })
      const gpa = calculateGPA([heavyCourse, lightCourse])
      // (4×4.0 + 1×2.0) / 5 = 18/5 = 3.6
      expect(gpa).toBeCloseTo(3.6, 5)
    })
  })

  describe('requirement classification — completed vs incomplete', () => {
    it('classifies requirement as completed when needed === 0', () => {
      const req = makeRequirement({ label: 'General Education', required: 30, earned: 30 })
      expect(classifyRequirement(req)).toBe('completed')
    })

    it('classifies requirement as in_progress when credits are in_progress but not complete', () => {
      const req = makeRequirement({ label: 'Major Requirements', required: 45, earned: 27, in_progress: 9 })
      expect(classifyRequirement(req)).toBe('in_progress')
    })

    it('classifies requirement as incomplete when needed > 0 and nothing in progress', () => {
      const req = makeRequirement({ label: 'Major Requirements', required: 45, earned: 27, in_progress: 0 })
      expect(classifyRequirement(req)).toBe('incomplete')
    })

    it('classifies all four requirements in the partial transcript correctly', () => {
      const classified = classifyAllRequirements(PARTIAL_REQUIREMENTS)
      const byLabel = Object.fromEntries(classified.map(({ req, status }) => [req.label, status]))

      expect(byLabel['General Education']).toBe('completed')
      expect(byLabel['Electives']).toBe('completed')
      expect(byLabel['Major Requirements']).toBe('incomplete')
      expect(byLabel['Degree credit']).toBe('incomplete')
    })

    it('reports correct completed and incomplete counts', () => {
      const classified = classifyAllRequirements(PARTIAL_REQUIREMENTS)
      const completedCount = classified.filter(({ status }) => status === 'completed').length
      const incompleteCount = classified.filter(({ status }) => status !== 'completed').length
      expect(completedCount).toBe(2) // General Education + Electives
      expect(incompleteCount).toBe(2) // Major Requirements + Degree credit
    })
  })

  describe('overall completion percentage', () => {
    it('returns 60% for 72 earned of 120 required', () => {
      const pct = computeOverallPercentage(PARTIAL_REQUIREMENTS)
      expect(pct).toBe(60)
    })

    it('uses the primary (Degree credit) requirement, not a sub-requirement', () => {
      const primary = findPrimaryRequirement(PARTIAL_REQUIREMENTS)
      expect(primary?.label).toBe('Degree credit')
      expect(primary?.required).toBe(120)
    })

    it('rounds to the nearest integer', () => {
      const reqs: CreditRequirement[] = [
        makeRequirement({ label: 'Degree credit', required: 120, earned: 91, in_progress: 0 }),
      ]
      // 91/120 = 75.833… → rounds to 76
      expect(computeOverallPercentage(reqs)).toBe(76)
    })

    it('caps at 100% even when earned exceeds required', () => {
      const reqs: CreditRequirement[] = [
        makeRequirement({ label: 'Degree credit', required: 120, earned: 135, in_progress: 0 }),
      ]
      expect(computeOverallPercentage(reqs)).toBe(100)
    })
  })
})

// ── Edge case: empty transcript (0%) ─────────────────────────────────────────

describe('degree audit report — edge case: empty transcript', () => {
  it('returns 0% completion when no credits are earned', () => {
    expect(calculateOverallProgress(0, 120)).toBe(0)
  })

  it('returns 0% when total required is 0 (no divide-by-zero)', () => {
    expect(calculateOverallProgress(0, 0)).toBe(0)
  })

  it('classifies all requirements as incomplete when transcript is empty', () => {
    const emptyReqs: CreditRequirement[] = [
      makeRequirement({ label: 'Degree credit', required: 120, earned: 0 }),
      makeRequirement({ label: 'General Education', required: 30, earned: 0 }),
      makeRequirement({ label: 'Major Requirements', required: 45, earned: 0 }),
    ]
    const classified = classifyAllRequirements(emptyReqs)
    expect(classified.every(({ status }) => status === 'incomplete')).toBe(true)
  })

  it('computes 0% overall for empty requirements list', () => {
    expect(computeOverallPercentage([])).toBe(0)
  })
})

// ── Edge case: all requirements met (100%) ────────────────────────────────────

describe('degree audit report — edge case: all requirements met', () => {
  const COMPLETE_REQUIREMENTS: CreditRequirement[] = [
    makeRequirement({ label: 'Degree credit', required: 120, earned: 120 }),
    makeRequirement({ label: 'General Education', required: 30, earned: 30 }),
    makeRequirement({ label: 'Major Requirements', required: 45, earned: 45 }),
    makeRequirement({ label: 'Electives', required: 15, earned: 15 }),
  ]

  it('returns 100% overall completion', () => {
    expect(computeOverallPercentage(COMPLETE_REQUIREMENTS)).toBe(100)
  })

  it('classifies all requirements as completed', () => {
    const classified = classifyAllRequirements(COMPLETE_REQUIREMENTS)
    expect(classified.every(({ status }) => status === 'completed')).toBe(true)
  })

  it('finds the primary requirement and confirms needed === 0', () => {
    const primary = findPrimaryRequirement(COMPLETE_REQUIREMENTS)
    expect(primary?.needed).toBe(0)
  })

  it('calculates 100% even when primary requirement has needed=0', () => {
    const req = makeRequirement({ label: 'Degree credit', required: 120, earned: 120 })
    expect(calculateOverallProgress(req.earned, req.required)).toBe(100)
  })
})

// ── Edge case: partial completion ─────────────────────────────────────────────

describe('degree audit report — edge case: partial completion', () => {
  const PARTIAL_MIDWAY: CreditRequirement[] = [
    makeRequirement({ label: 'Degree credit', required: 120, earned: 60 }),
    makeRequirement({ label: 'General Education', required: 30, earned: 30 }),
    makeRequirement({ label: 'Major Requirements', required: 45, earned: 15, in_progress: 12 }),
    makeRequirement({ label: 'Electives', required: 15, earned: 0 }),
  ]

  it('returns 50% when exactly half the degree credits are earned', () => {
    expect(computeOverallPercentage(PARTIAL_MIDWAY)).toBe(50)
  })

  it('classifies in-progress requirements correctly', () => {
    const major = PARTIAL_MIDWAY.find((r) => r.label === 'Major Requirements')!
    expect(classifyRequirement(major)).toBe('in_progress')
  })

  it('classifies not-started requirements correctly', () => {
    const electives = PARTIAL_MIDWAY.find((r) => r.label === 'Electives')!
    expect(classifyRequirement(electives)).toBe('incomplete')
  })

  it('counts mixed requirement statuses correctly', () => {
    const classified = classifyAllRequirements(PARTIAL_MIDWAY)
    const completed = classified.filter(({ status }) => status === 'completed').length
    const inProgress = classified.filter(({ status }) => status === 'in_progress').length
    const incomplete = classified.filter(({ status }) => status === 'incomplete').length
    expect(completed).toBe(1)   // General Education
    expect(inProgress).toBe(1)  // Major Requirements
    expect(incomplete).toBe(2)  // Degree credit (earned < required), Electives
  })

  it('needed field reflects true remaining credits after in_progress', () => {
    // Major: required=45, earned=15, in_progress=12 → needed = 45-15-12 = 18
    const major = PARTIAL_MIDWAY.find((r) => r.label === 'Major Requirements')!
    expect(major.needed).toBe(18)
  })

  it('findPrimaryRequirement falls back to largest required when no "degree credit" label', () => {
    const noLabelReqs: CreditRequirement[] = [
      makeRequirement({ label: 'Core', required: 60, earned: 30 }),
      makeRequirement({ label: 'Major', required: 45, earned: 20 }),
      makeRequirement({ label: 'Electives', required: 15, earned: 5 }),
    ]
    const primary = findPrimaryRequirement(noLabelReqs)
    expect(primary?.label).toBe('Core')
    expect(primary?.required).toBe(60)
  })
})
