/**
 * Course prerequisite validation utilities.
 * Checks whether a course's prerequisites are satisfied
 * by the courses already in a schedule.
 */

export interface CoursePrereq {
  courseId: string
  prerequisites: string[] // courseIds that must appear in schedule first
}

export interface PrereqResult {
  ok: boolean
  missing: string[]
}

/**
 * Validate that all prerequisites for a course are present in the schedule.
 */
export function checkPrerequisites(
  course: CoursePrereq,
  scheduledCourseIds: string[],
): PrereqResult {
  if (course.prerequisites.length === 0) {
    return { ok: true, missing: [] }
  }
  const scheduled = new Set(scheduledCourseIds)
  const missing = course.prerequisites.filter((id) => !scheduled.has(id))
  return { ok: missing.length === 0, missing }
}

/**
 * Detect if a set of prerequisite definitions contains a cycle.
 * Returns true if any cycle exists.
 */
export function hasPrerequisiteCycle(courses: CoursePrereq[]): boolean {
  const graph = new Map<string, string[]>()
  for (const c of courses) {
    graph.set(c.courseId, c.prerequisites)
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(node: string): boolean {
    if (inStack.has(node)) return true
    if (visited.has(node)) return false
    visited.add(node)
    inStack.add(node)
    for (const dep of graph.get(node) ?? []) {
      if (dfs(dep)) return true
    }
    inStack.delete(node)
    return false
  }

  for (const c of courses) {
    if (dfs(c.courseId)) return true
  }
  return false
}
