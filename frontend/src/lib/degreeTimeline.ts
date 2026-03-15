/**
 * Degree progress timeline utilities.
 * Maps courses into academic-year milestones with completion status.
 */

export type MilestoneStatus = 'completed' | 'active' | 'pending'

export interface YearMilestone {
  year: number
  label: string
  status: MilestoneStatus
  coursesTotal: number
  coursesCompleted: number
}

export interface TimelineCourse {
  year: number
  grade?: string | null
}

/**
 * Build a timeline of year-based milestones from courses.
 *
 * @param courses   – list of courses with their academic year and optional grade
 * @param currentYear – the student's current academic year (1-based)
 * @returns ordered array of YearMilestone entries
 */
export function buildDegreeTimeline(
  courses: TimelineCourse[],
  currentYear: number,
): YearMilestone[] {
  if (courses.length === 0) return []

  const years = new Set(courses.map((c) => c.year))
  const sorted = [...years].sort((a, b) => a - b)

  return sorted.map((year) => {
    const yearCourses = courses.filter((c) => c.year === year)
    const total = yearCourses.length
    const completed = yearCourses.filter(
      (c) => c.grade != null && c.grade !== '',
    ).length

    let status: MilestoneStatus
    if (year < currentYear || (year === currentYear && completed === total && total > 0)) {
      status = completed === total && total > 0 ? 'completed' : 'pending'
    } else if (year === currentYear) {
      status = 'active'
    } else {
      status = 'pending'
    }

    // Override: past year with all courses graded is always completed
    if (year < currentYear && completed === total && total > 0) {
      status = 'completed'
    }

    return {
      year,
      label: `Year ${year}`,
      status,
      coursesTotal: total,
      coursesCompleted: completed,
    }
  })
}
