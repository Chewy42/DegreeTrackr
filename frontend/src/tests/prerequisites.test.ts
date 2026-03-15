import { describe, expect, it } from 'vitest'
import { checkPrerequisites, hasPrerequisiteCycle } from '../lib/prerequisiteCheck'

describe('Course prerequisite validation — DT158', () => {
  it('CS201 (prereq: CS101) when CS101 NOT in schedule → warning with missing CS101', () => {
    const result = checkPrerequisites(
      { courseId: 'CS201', prerequisites: ['CS101'] },
      [],
    )
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(['CS101'])
  })

  it('CS201 when CS101 IS in schedule → succeeds (no warning)', () => {
    const result = checkPrerequisites(
      { courseId: 'CS201', prerequisites: ['CS101'] },
      ['CS101', 'MATH150'],
    )
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('course with no prerequisites → always succeeds', () => {
    const result = checkPrerequisites(
      { courseId: 'ENG100', prerequisites: [] },
      [],
    )
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('multiple prerequisites: missing one triggers warning', () => {
    const result = checkPrerequisites(
      { courseId: 'CS301', prerequisites: ['CS101', 'CS201'] },
      ['CS101'],
    )
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(['CS201'])
  })

  it('circular prerequisite chain detected (no crash)', () => {
    const hasCycle = hasPrerequisiteCycle([
      { courseId: 'A', prerequisites: ['B'] },
      { courseId: 'B', prerequisites: ['C'] },
      { courseId: 'C', prerequisites: ['A'] },
    ])
    expect(hasCycle).toBe(true)

    const noCycle = hasPrerequisiteCycle([
      { courseId: 'A', prerequisites: ['B'] },
      { courseId: 'B', prerequisites: [] },
    ])
    expect(noCycle).toBe(false)
  })
})
