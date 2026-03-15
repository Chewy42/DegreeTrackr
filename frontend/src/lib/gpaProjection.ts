/**
 * GPA projection utilities.
 * Projects a future GPA by combining current graded courses
 * with planned future courses and their expected grades.
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

export interface GradedCourse {
  grade: string
  credits: number
}

export interface FutureCourse {
  expectedGrade: string
  credits: number
}

/**
 * Project GPA by combining current graded courses with future planned courses.
 *
 * @param current – courses already completed with letter grades
 * @param future  – planned courses with expected grades
 * @returns projected GPA (0.0 when no valid courses)
 */
export function projectGpa(
  current: GradedCourse[],
  future: FutureCourse[],
): number {
  let totalPoints = 0
  let totalCredits = 0

  for (const c of current) {
    const pts = GRADE_POINTS[c.grade]
    if (pts === undefined) continue
    totalPoints += pts * c.credits
    totalCredits += c.credits
  }

  for (const f of future) {
    const pts = GRADE_POINTS[f.expectedGrade]
    if (pts === undefined) continue
    totalPoints += pts * f.credits
    totalCredits += f.credits
  }

  if (totalCredits === 0) return 0.0
  return totalPoints / totalCredits
}
