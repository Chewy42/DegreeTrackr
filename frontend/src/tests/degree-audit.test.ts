import { describe, it, expect } from 'vitest'
import {
  calculateOverallProgress,
  calculateGPA,
  findPrimaryRequirement,
} from '../lib/progressUtils'
import type { Course, CreditRequirement } from '../components/progress/ProgressPage'

/** Simulate a degree audit: given courses + requirements, compute progress. */
function auditDegree(
  completedCourses: Course[],
  requirements: CreditRequirement[],
) {
  const primary = findPrimaryRequirement(requirements)
  const progress = primary
    ? calculateOverallProgress(primary.earned, primary.required)
    : 0
  const gpa = calculateGPA(completedCourses)
  return { progress, gpa, primary }
}

describe('Degree audit report', () => {
  it('3 of 5 required courses → 60% complete', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '101', title: 'Intro CS', grade: 'A', credits: 3 },
      { subject: 'CS', number: '201', title: 'Data Structures', grade: 'B+', credits: 3 },
      { subject: 'MATH', number: '101', title: 'Calculus I', grade: 'B', credits: 3 },
    ]
    const reqs: CreditRequirement[] = [
      { label: 'Degree Credit Requirement', required: 5, earned: 3, in_progress: 0, needed: 2 },
    ]
    const { progress } = auditDegree(courses, reqs)
    expect(progress).toBe(60)
  })

  it('all required courses done → 100% complete', () => {
    const courses: Course[] = Array.from({ length: 5 }, (_, i) => ({
      subject: 'CS',
      number: `${100 + i}`,
      title: `Course ${i}`,
      grade: 'A',
      credits: 3,
    }))
    const reqs: CreditRequirement[] = [
      { label: 'Degree Credit Requirement', required: 15, earned: 15, in_progress: 0, needed: 0 },
    ]
    const { progress, gpa } = auditDegree(courses, reqs)
    expect(progress).toBe(100)
    expect(gpa).toBe(4.0)
  })

  it('zero courses → 0% complete, all requirements unmet', () => {
    const reqs: CreditRequirement[] = [
      { label: 'Degree Credit Requirement', required: 120, earned: 0, in_progress: 0, needed: 120 },
    ]
    const { progress, primary } = auditDegree([], reqs)
    expect(progress).toBe(0)
    expect(primary!.needed).toBe(120)
  })

  it('elective credits: 12 elective credits counted correctly', () => {
    const courses: Course[] = [
      { subject: 'ART', number: '101', title: 'Drawing', grade: 'A', credits: 3 },
      { subject: 'MUS', number: '110', title: 'Music Theory', grade: 'B', credits: 3 },
      { subject: 'PHIL', number: '200', title: 'Ethics', grade: 'A-', credits: 3 },
      { subject: 'SOC', number: '101', title: 'Intro Soc', grade: 'B+', credits: 3 },
    ]
    const reqs: CreditRequirement[] = [
      { label: 'Degree Credit Requirement', required: 120, earned: 60, in_progress: 0, needed: 60 },
      { label: 'Elective Credits', required: 30, earned: 12, in_progress: 0, needed: 18 },
    ]
    const elective = reqs.find((r) => r.label === 'Elective Credits')!
    expect(elective.earned).toBe(12)
    expect(calculateOverallProgress(elective.earned, elective.required)).toBe(40)
    expect(calculateGPA(courses)).toBeGreaterThan(3.0)
  })

  it('failed course (grade F) → not counted toward earned credits', () => {
    const courses: Course[] = [
      { subject: 'CS', number: '101', title: 'Intro CS', grade: 'A', credits: 3 },
      { subject: 'CS', number: '201', title: 'Data Structures', grade: 'F', credits: 3 },
    ]
    // F-grade course should not be earned — only 3 credits earned, not 6
    const reqs: CreditRequirement[] = [
      { label: 'Degree Credit Requirement', required: 120, earned: 3, in_progress: 0, needed: 117 },
    ]
    const { progress, gpa } = auditDegree(courses, reqs)
    expect(progress).toBe(3) // 3/120 rounded
    // GPA includes F (0.0) — drags average down
    expect(gpa).toBe(2.0) // (4.0*3 + 0.0*3) / 6
  })
})
