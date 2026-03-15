import type { Course, CreditRequirement } from '../components/progress/ProgressPage'

/**
 * Grade point values for GPA calculation and best-grade comparison.
 * Higher value = better grade.
 */
const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0,
  A: 4.0,
  'A-': 3.7,
  'B+': 3.3,
  B: 3.0,
  'B-': 2.7,
  'C+': 2.3,
  C: 2.0,
  'C-': 1.7,
  'D+': 1.3,
  D: 1.0,
  'D-': 0.7,
  F: 0.0,
}

function gradeValue(grade: string | null | undefined): number {
  if (!grade) return -1
  return GRADE_POINTS[grade] ?? -1
}

/**
 * Deduplicate courses by subject+number, keeping the attempt with the best grade.
 * If a course was retaken, only the highest-grade attempt is kept.
 * Courses without subject+number are always kept (cannot be deduped).
 */
export function deduplicateCourses(courses: Course[]): Course[] {
  const bestByKey = new Map<string, Course>()
  const ungroupable: Course[] = []

  for (const course of courses) {
    if (!course.subject || !course.number) {
      ungroupable.push(course)
      continue
    }

    const key = `${course.subject}|${course.number}`
    const existing = bestByKey.get(key)

    if (!existing || gradeValue(course.grade) > gradeValue(existing.grade)) {
      bestByKey.set(key, course)
    }
  }

  return [...bestByKey.values(), ...ungroupable]
}

/**
 * Find the primary degree-level credit requirement.
 * Prefers a requirement labelled "Degree credit" (or similar),
 * falls back to the requirement with the largest `required` value.
 */
export function findPrimaryRequirement(
  requirements: CreditRequirement[],
): CreditRequirement | undefined {
  const byLabel = requirements.find((req) =>
    req.label.toLowerCase().includes('degree credit'),
  )
  if (byLabel) return byLabel

  if (requirements.length === 0) return undefined

  return requirements.reduce<CreditRequirement | undefined>((max, req) => {
    if (!max) return req
    return req.required > max.required ? req : max
  }, undefined)
}

/**
 * Calculate overall degree progress percentage, capped at 100%.
 */
export function calculateOverallProgress(
  earned: number,
  required: number,
): number {
  if (required <= 0) return 0
  return Math.min(100, Math.round((earned / required) * 100))
}
