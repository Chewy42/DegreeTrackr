// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { buildDegreeTimeline, type TimelineCourse } from './degreeTimeline'

describe('buildDegreeTimeline', () => {
  it('returns empty array for empty courses', () => {
    expect(buildDegreeTimeline([], 1)).toEqual([])
  })

  it('returns one milestone for single-year courses', () => {
    const courses: TimelineCourse[] = [{ year: 1, grade: 'A' }, { year: 1, grade: 'B' }]
    const result = buildDegreeTimeline(courses, 2)
    expect(result).toHaveLength(1)
    expect(result[0].year).toBe(1)
    expect(result[0].label).toBe('Year 1')
  })

  it('returns milestones sorted by year', () => {
    const courses: TimelineCourse[] = [
      { year: 3, grade: 'A' },
      { year: 1, grade: 'B' },
      { year: 2, grade: 'C' },
    ]
    const result = buildDegreeTimeline(courses, 4)
    expect(result.map(m => m.year)).toEqual([1, 2, 3])
  })

  it('marks past fully-graded year as completed', () => {
    const courses: TimelineCourse[] = [{ year: 1, grade: 'A' }, { year: 1, grade: 'B' }]
    const result = buildDegreeTimeline(courses, 2) // currentYear = 2, year 1 is past
    expect(result[0].status).toBe('completed')
  })

  it('marks current year as active when not all courses graded', () => {
    const courses: TimelineCourse[] = [
      { year: 2, grade: 'A' },
      { year: 2, grade: null }, // not yet graded
    ]
    const result = buildDegreeTimeline(courses, 2)
    expect(result[0].status).toBe('active')
  })

  it('marks future year as pending', () => {
    const courses: TimelineCourse[] = [{ year: 3, grade: null }]
    const result = buildDegreeTimeline(courses, 2)
    expect(result[0].status).toBe('pending')
  })

  it('correctly counts coursesCompleted vs coursesTotal', () => {
    const courses: TimelineCourse[] = [
      { year: 1, grade: 'A' },
      { year: 1, grade: '' },  // empty string = not graded
      { year: 1, grade: null },
    ]
    const result = buildDegreeTimeline(courses, 2)
    expect(result[0].coursesTotal).toBe(3)
    expect(result[0].coursesCompleted).toBe(1)
  })

  it('marks current year with all courses graded as completed', () => {
    const courses: TimelineCourse[] = [{ year: 2, grade: 'A' }, { year: 2, grade: 'B' }]
    // currentYear = 2 and all graded → completed
    const result = buildDegreeTimeline(courses, 2)
    expect(result[0].status).toBe('completed')
  })

  it('handles a 4-year plan with correct statuses', () => {
    const courses: TimelineCourse[] = [
      { year: 1, grade: 'A' }, { year: 1, grade: 'B' }, // past complete
      { year: 2, grade: 'A' }, { year: 2, grade: null }, // current, partial
      { year: 3, grade: null },                           // future
      { year: 4, grade: null },                           // future
    ]
    const result = buildDegreeTimeline(courses, 2)
    expect(result).toHaveLength(4)
    expect(result[0].status).toBe('completed') // year 1
    expect(result[1].status).toBe('active')    // year 2
    expect(result[2].status).toBe('pending')   // year 3
    expect(result[3].status).toBe('pending')   // year 4
  })
})
