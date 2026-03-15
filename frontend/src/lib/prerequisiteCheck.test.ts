// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { checkPrerequisites, hasPrerequisiteCycle, type CoursePrereq } from './prerequisiteCheck'

describe('checkPrerequisites', () => {
  it('passes when course has no prerequisites', () => {
    const result = checkPrerequisites({ courseId: 'CS301', prerequisites: [] }, [])
    expect(result.ok).toBe(true)
    expect(result.missing).toHaveLength(0)
  })

  it('passes when all prerequisites are in schedule', () => {
    const result = checkPrerequisites(
      { courseId: 'CS301', prerequisites: ['CS101', 'CS201'] },
      ['CS101', 'CS201', 'MATH101'],
    )
    expect(result.ok).toBe(true)
    expect(result.missing).toHaveLength(0)
  })

  it('fails when one prerequisite is missing', () => {
    const result = checkPrerequisites(
      { courseId: 'CS301', prerequisites: ['CS101', 'CS201'] },
      ['CS101'], // CS201 missing
    )
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(['CS201'])
  })

  it('fails when all prerequisites are missing', () => {
    const result = checkPrerequisites(
      { courseId: 'CS301', prerequisites: ['CS101', 'CS201'] },
      [],
    )
    expect(result.ok).toBe(false)
    expect(result.missing).toHaveLength(2)
  })

  it('passes with an empty schedule for no-prerequisite course', () => {
    const result = checkPrerequisites({ courseId: 'CS101', prerequisites: [] }, [])
    expect(result.ok).toBe(true)
  })
})

describe('hasPrerequisiteCycle', () => {
  it('returns false for an empty list', () => {
    expect(hasPrerequisiteCycle([])).toBe(false)
  })

  it('returns false for independent courses', () => {
    const courses: CoursePrereq[] = [
      { courseId: 'CS101', prerequisites: [] },
      { courseId: 'CS201', prerequisites: [] },
    ]
    expect(hasPrerequisiteCycle(courses)).toBe(false)
  })

  it('returns false for a linear chain (no cycle)', () => {
    const courses: CoursePrereq[] = [
      { courseId: 'CS101', prerequisites: [] },
      { courseId: 'CS201', prerequisites: ['CS101'] },
      { courseId: 'CS301', prerequisites: ['CS201'] },
    ]
    expect(hasPrerequisiteCycle(courses)).toBe(false)
  })

  it('returns true for a direct cycle A → B → A', () => {
    const courses: CoursePrereq[] = [
      { courseId: 'A', prerequisites: ['B'] },
      { courseId: 'B', prerequisites: ['A'] },
    ]
    expect(hasPrerequisiteCycle(courses)).toBe(true)
  })

  it('returns true for a longer cycle A → B → C → A', () => {
    const courses: CoursePrereq[] = [
      { courseId: 'A', prerequisites: ['C'] },
      { courseId: 'B', prerequisites: ['A'] },
      { courseId: 'C', prerequisites: ['B'] },
    ]
    expect(hasPrerequisiteCycle(courses)).toBe(true)
  })

  it('returns false for a single course with no prerequisites', () => {
    expect(hasPrerequisiteCycle([{ courseId: 'CS101', prerequisites: [] }])).toBe(false)
  })
})
