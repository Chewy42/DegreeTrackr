import { describe, expect, it } from 'vitest'
import type { Course, CreditRequirement } from '../components/progress/ProgressPage'
import {
  calculateGPA,
  calculateOverallProgress,
  deduplicateCourses,
  findPrimaryRequirement,
} from './progressUtils'

/**
 * Realistic 10-course transcript covering:
 * - Standard letter grades (A, B+, C)
 * - Pass/Fail (P)
 * - A repeated course (MATH 201 taken twice, D then B+)
 * - Various credit weights (1–4 credits)
 */
const TRANSCRIPT: Course[] = [
  { term: 'Fall 2024', subject: 'CS', number: '101', title: 'Intro to CS', grade: 'A', credits: 4 },
  { term: 'Fall 2024', subject: 'MATH', number: '101', title: 'Calculus I', grade: 'B+', credits: 4 },
  { term: 'Fall 2024', subject: 'ENG', number: '110', title: 'English Comp', grade: 'A-', credits: 3 },
  { term: 'Spring 2025', subject: 'CS', number: '201', title: 'Data Structures', grade: 'B', credits: 4 },
  { term: 'Spring 2025', subject: 'MATH', number: '201', title: 'Calculus II', grade: 'D', credits: 4 },
  { term: 'Spring 2025', subject: 'PHYS', number: '101', title: 'Physics I', grade: 'C', credits: 3 },
  { term: 'Spring 2025', subject: 'PE', number: '100', title: 'Wellness', grade: 'P', credits: 1 },
  { term: 'Fall 2025', subject: 'MATH', number: '201', title: 'Calculus II (retake)', grade: 'B+', credits: 4 },
  { term: 'Fall 2025', subject: 'CS', number: '301', title: 'Algorithms', grade: 'A', credits: 3 },
  { term: 'Fall 2025', subject: 'HIST', number: '200', title: 'World History', grade: 'C', credits: 3 },
]

describe('Degree progress accuracy integration', () => {
  describe('GPA calculation on realistic transcript', () => {
    it('computes the correct weighted GPA excluding P/F and keeping best retake grade', () => {
      const gpa = calculateGPA(TRANSCRIPT)

      // After dedup: MATH 201 keeps B+ (3.3) over D (1.0)
      // Excluded: PE 100 (P grade)
      // Included courses and weights:
      //   CS 101:   A   (4.0) × 4 = 16.0
      //   MATH 101: B+  (3.3) × 4 = 13.2
      //   ENG 110:  A-  (3.7) × 3 = 11.1
      //   CS 201:   B   (3.0) × 4 = 12.0
      //   MATH 201: B+  (3.3) × 4 = 13.2
      //   PHYS 101: C   (2.0) × 3 =  6.0
      //   CS 301:   A   (4.0) × 3 = 12.0
      //   HIST 200: C   (2.0) × 3 =  6.0
      // Total points = 89.5, Total credits = 28
      // GPA = 89.5 / 28 ≈ 3.196…
      expect(gpa).toBeCloseTo(89.5 / 28, 4)
    })

    it('deduplicates the repeated MATH 201 keeping the better grade', () => {
      const deduped = deduplicateCourses(TRANSCRIPT)
      const math201s = deduped.filter(c => c.subject === 'MATH' && c.number === '201')
      expect(math201s).toHaveLength(1)
      expect(math201s[0].grade).toBe('B+')
    })
  })

  describe('Credit counting on realistic transcript', () => {
    it('counts completed credits correctly after dedup', () => {
      const deduped = deduplicateCourses(TRANSCRIPT)
      // All 9 unique courses contribute credits (including P/F)
      const completedCredits = deduped.reduce((sum, c) => sum + c.credits, 0)
      // 4 + 4 + 3 + 4 + 4 + 3 + 1 + 3 + 3 = 29
      expect(completedCredits).toBe(29)
    })
  })

  describe('Overall degree progress percentage', () => {
    it('computes correct progress from completed credits vs requirement', () => {
      const deduped = deduplicateCourses(TRANSCRIPT)
      const earned = deduped.reduce((sum, c) => sum + c.credits, 0) // 29
      const required = 120

      const progress = calculateOverallProgress(earned, required)
      // Math.min(100, Math.round((29/120) * 100)) = Math.round(24.166…) = 24
      expect(progress).toBe(24)
    })

    it('uses findPrimaryRequirement to select the right target', () => {
      const requirements: CreditRequirement[] = [
        { label: 'General Education', required: 45, earned: 12, in_progress: 0, needed: 33 },
        { label: 'Total Degree Credit Hours', required: 120, earned: 29, in_progress: 0, needed: 91 },
        { label: 'Major Requirements', required: 60, earned: 8, in_progress: 4, needed: 48 },
      ]
      const primary = findPrimaryRequirement(requirements)
      expect(primary).toBeDefined()
      expect(primary!.label).toBe('Total Degree Credit Hours')
      expect(primary!.required).toBe(120)

      const progress = calculateOverallProgress(primary!.earned, primary!.required)
      expect(progress).toBe(24) // Math.round(29/120 * 100)
    })
  })

  describe('Edge case: 0 courses', () => {
    it('returns 0 GPA for an empty transcript', () => {
      expect(calculateGPA([])).toBe(0.0)
    })

    it('returns 0 completed credits', () => {
      const deduped = deduplicateCourses([])
      expect(deduped.reduce((sum, c) => sum + c.credits, 0)).toBe(0)
    })

    it('returns 0% progress', () => {
      expect(calculateOverallProgress(0, 120)).toBe(0)
    })
  })

  describe('Edge case: all requirements met', () => {
    it('returns 100% progress when earned equals required', () => {
      expect(calculateOverallProgress(120, 120)).toBe(100)
    })

    it('caps at 100% when earned exceeds required', () => {
      expect(calculateOverallProgress(135, 120)).toBe(100)
    })
  })

  describe('Edge case: required is 0 or negative', () => {
    it('returns 0% progress when required is 0', () => {
      expect(calculateOverallProgress(30, 0)).toBe(0)
    })

    it('returns 0% progress when required is negative', () => {
      expect(calculateOverallProgress(30, -10)).toBe(0)
    })
  })
})
