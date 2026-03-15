import { describe, it, expect } from 'vitest'

type Course = {
  courseId: string
  name: string
  credits: number
}

/** Search courses by query matching courseId or name (case-insensitive). */
function searchCourses(courses: Course[], query: string): Course[] {
  const q = query.trim().toLowerCase()
  if (!q) return courses
  return courses.filter(
    (c) =>
      c.courseId.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q),
  )
}

/** Filter courses to only those with a specific credit count. */
function filterByCredits(courses: Course[], credits: number): Course[] {
  return courses.filter((c) => c.credits === credits)
}

/** Sort courses alphabetically by name. */
function sortByName(courses: Course[]): Course[] {
  return [...courses].sort((a, b) => a.name.localeCompare(b.name))
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const catalog: Course[] = [
  { courseId: 'CS 101', name: 'Intro to Computer Science', credits: 3 },
  { courseId: 'CS 201', name: 'Data Structures', credits: 3 },
  { courseId: 'MATH 150', name: 'Calculus I', credits: 4 },
  { courseId: 'ENG 110', name: 'Composition', credits: 3 },
  { courseId: 'CS 350', name: 'Software Design', credits: 4 },
]

describe('Course search and filter', () => {
  it('search "CS" returns all courses with CS in courseId or name', () => {
    const results = searchCourses(catalog, 'CS')
    expect(results).toHaveLength(3)
    expect(results.every((c) => c.courseId.includes('CS') || c.name.toLowerCase().includes('cs'))).toBe(true)
  })

  it('filter by credits=3 returns only 3-credit courses', () => {
    const results = filterByCredits(catalog, 3)
    expect(results).toHaveLength(3)
    expect(results.every((c) => c.credits === 3)).toBe(true)
    expect(results.map((c) => c.courseId)).toEqual(['CS 101', 'CS 201', 'ENG 110'])
  })

  it('sort by name alphabetically places first result correctly', () => {
    const sorted = sortByName(catalog)
    expect(sorted[0]!.name).toBe('Calculus I')
    expect(sorted[sorted.length - 1]!.name).toBe('Software Design')
  })

  it('empty search query returns all courses', () => {
    expect(searchCourses(catalog, '')).toHaveLength(catalog.length)
    expect(searchCourses(catalog, '   ')).toHaveLength(catalog.length)
  })

  it('search with no matches returns empty array without crashing', () => {
    const results = searchCourses(catalog, 'PHYS 999 nonexistent')
    expect(results).toEqual([])
  })
})
