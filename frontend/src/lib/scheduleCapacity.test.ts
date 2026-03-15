// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { addCourseToSchedule, MAX_SCHEDULE_COURSES } from './scheduleCapacity'

describe('addCourseToSchedule', () => {
  it('adds a course to an empty schedule', () => {
    const result = addCourseToSchedule([], 'CS101')
    expect(result).toEqual(['CS101'])
  })

  it('adds a course to a non-empty schedule', () => {
    const result = addCourseToSchedule(['CS101'], 'CS201')
    expect(result).toEqual(['CS101', 'CS201'])
  })

  it('throws when course is already in schedule', () => {
    expect(() => addCourseToSchedule(['CS101', 'CS201'], 'CS101')).toThrow(/already in schedule/i)
  })

  it(`throws when schedule is at MAX_SCHEDULE_COURSES (${MAX_SCHEDULE_COURSES})`, () => {
    const full = Array.from({ length: MAX_SCHEDULE_COURSES }, (_, i) => `COURSE${i}`)
    expect(() => addCourseToSchedule(full, 'CS999')).toThrow(/schedule full/i)
  })

  it(`allows adding when schedule has exactly MAX_SCHEDULE_COURSES - 1 courses`, () => {
    const nearFull = Array.from({ length: MAX_SCHEDULE_COURSES - 1 }, (_, i) => `COURSE${i}`)
    expect(() => addCourseToSchedule(nearFull, 'NEWCOURSE')).not.toThrow()
    expect(addCourseToSchedule(nearFull, 'NEWCOURSE')).toHaveLength(MAX_SCHEDULE_COURSES)
  })

  it('does not mutate the original array', () => {
    const original = ['CS101']
    addCourseToSchedule(original, 'CS201')
    expect(original).toEqual(['CS101'])
  })

  it('MAX_SCHEDULE_COURSES is 20', () => {
    expect(MAX_SCHEDULE_COURSES).toBe(20)
  })
})
