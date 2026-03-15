import { describe, expect, it } from 'vitest'
import { buildDegreeTimeline } from '../lib/degreeTimeline'
import type { TimelineCourse } from '../lib/degreeTimeline'

describe('Degree progress timeline — DT163', () => {
  it('timeline with 4 years renders 4 milestone entries', () => {
    const courses: TimelineCourse[] = [
      { year: 1, grade: 'A' },
      { year: 2, grade: 'B' },
      { year: 3, grade: null },
      { year: 4, grade: null },
    ]
    const timeline = buildDegreeTimeline(courses, 3)
    expect(timeline).toHaveLength(4)
    expect(timeline.map((m) => m.year)).toEqual([1, 2, 3, 4])
  })

  it('completed years (all courses graded) are marked as completed', () => {
    const courses: TimelineCourse[] = [
      { year: 1, grade: 'A' },
      { year: 1, grade: 'B' },
      { year: 2, grade: null },
    ]
    const timeline = buildDegreeTimeline(courses, 2)
    const year1 = timeline.find((m) => m.year === 1)!
    expect(year1.status).toBe('completed')
    expect(year1.coursesCompleted).toBe(2)
    expect(year1.coursesTotal).toBe(2)
  })

  it('current year highlighted as active', () => {
    const courses: TimelineCourse[] = [
      { year: 1, grade: 'A' },
      { year: 2, grade: 'B' },
      { year: 2, grade: null },
      { year: 3, grade: null },
    ]
    const timeline = buildDegreeTimeline(courses, 2)
    const year2 = timeline.find((m) => m.year === 2)!
    expect(year2.status).toBe('active')
  })

  it('future years are pending', () => {
    const courses: TimelineCourse[] = [
      { year: 1, grade: 'A' },
      { year: 2, grade: null },
      { year: 3, grade: null },
    ]
    const timeline = buildDegreeTimeline(courses, 1)
    expect(timeline.find((m) => m.year === 2)!.status).toBe('pending')
    expect(timeline.find((m) => m.year === 3)!.status).toBe('pending')
  })

  it('empty timeline (0 courses) renders gracefully', () => {
    const timeline = buildDegreeTimeline([], 1)
    expect(timeline).toEqual([])
  })
})
