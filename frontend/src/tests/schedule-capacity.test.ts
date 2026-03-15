import { describe, expect, it } from 'vitest'
import { addCourseToSchedule, MAX_SCHEDULE_COURSES } from '../lib/scheduleCapacity'

describe('Schedule capacity limit — DT148', () => {
  it('add 20 courses → all succeed', () => {
    let ids: string[] = []
    for (let i = 1; i <= 20; i++) {
      ids = addCourseToSchedule(ids, `CLS-${i}`)
    }
    expect(ids).toHaveLength(20)
  })

  it('add 21st course → throws "Schedule full"', () => {
    const ids = Array.from({ length: MAX_SCHEDULE_COURSES }, (_, i) => `CLS-${i + 1}`)
    expect(() => addCourseToSchedule(ids, 'CLS-21')).toThrow('Schedule full')
  })

  it('after rejection, course count stays at 20', () => {
    const ids = Array.from({ length: MAX_SCHEDULE_COURSES }, (_, i) => `CLS-${i + 1}`)
    try { addCourseToSchedule(ids, 'CLS-21') } catch { /* expected */ }
    expect(ids).toHaveLength(20)
  })

  it('adding with 0 courses works (boundary base case)', () => {
    const result = addCourseToSchedule([], 'CLS-1')
    expect(result).toEqual(['CLS-1'])
  })

  it('adding duplicate course → throws "Course already in schedule"', () => {
    const ids = ['CLS-1', 'CLS-2']
    expect(() => addCourseToSchedule(ids, 'CLS-1')).toThrow('Course already in schedule')
  })
})
