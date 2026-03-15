/**
 * Semester grouping utilities.
 *
 * Groups schedule courses by their semester label (e.g. "Fall 2024",
 * "Spring 2025") and sorts groups by academic term order.
 */

/** Term weight used for sorting: Spring < Summer < Fall */
const TERM_ORDER: Record<string, number> = {
  spring: 0,
  summer: 1,
  fall: 2,
}

export interface SemesterGroup<T extends { semester: string }> {
  semester: string
  courses: T[]
}

/**
 * Parse a semester string like "spring2026", "Fall 2024", "fall2025" into
 * a comparable { term, year } pair.
 */
function parseSemester(raw: string): { term: string; year: number } {
  const normalized = raw.toLowerCase().replace(/\s+/g, '')
  const match = normalized.match(/^(spring|summer|fall)(\d{4})$/)
  if (!match) return { term: raw.toLowerCase(), year: 0 }
  return { term: match[1]!, year: Number(match[2]) }
}

function semesterSortKey(semester: string): number {
  const { term, year } = parseSemester(semester)
  return year * 10 + (TERM_ORDER[term] ?? 5)
}

/**
 * Group courses by their `semester` field and return sorted groups.
 *
 * - Courses with the same normalized semester are grouped together.
 * - Groups are sorted by year first, then term (Spring → Summer → Fall).
 * - Empty input returns an empty array (no crash).
 */
export function groupBySemester<T extends { semester: string }>(
  courses: T[],
): SemesterGroup<T>[] {
  const map = new Map<string, T[]>()

  for (const course of courses) {
    const key = course.semester
    const existing = map.get(key)
    if (existing) {
      existing.push(course)
    } else {
      map.set(key, [course])
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => semesterSortKey(a) - semesterSortKey(b))
    .map(([semester, items]) => ({ semester, courses: items }))
}
