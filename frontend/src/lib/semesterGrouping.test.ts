// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { groupBySemester } from './semesterGrouping'

type Course = { id: string; semester: string }

describe('groupBySemester', () => {
  it('returns empty array for empty input', () => {
    expect(groupBySemester([])).toEqual([])
  })

  it('returns one group for single course', () => {
    const result = groupBySemester([{ id: 'c1', semester: 'spring2026' }])
    expect(result).toHaveLength(1)
    expect(result[0].semester).toBe('spring2026')
    expect(result[0].courses).toHaveLength(1)
  })

  it('groups courses with the same semester together', () => {
    const courses: Course[] = [
      { id: 'c1', semester: 'fall2025' },
      { id: 'c2', semester: 'fall2025' },
      { id: 'c3', semester: 'spring2026' },
    ]
    const result = groupBySemester(courses)
    const fall = result.find(g => g.semester === 'fall2025')!
    expect(fall.courses).toHaveLength(2)
  })

  it('sorts groups by year first (earlier year before later)', () => {
    const courses: Course[] = [
      { id: 'c1', semester: 'fall2026' },
      { id: 'c2', semester: 'spring2025' },
    ]
    const result = groupBySemester(courses)
    expect(result[0].semester).toBe('spring2025')
    expect(result[1].semester).toBe('fall2026')
  })

  it('sorts same year: Spring before Summer before Fall', () => {
    const courses: Course[] = [
      { id: 'c3', semester: 'fall2025' },
      { id: 'c1', semester: 'spring2025' },
      { id: 'c2', semester: 'summer2025' },
    ]
    const result = groupBySemester(courses)
    expect(result[0].semester).toBe('spring2025')
    expect(result[1].semester).toBe('summer2025')
    expect(result[2].semester).toBe('fall2025')
  })

  it('returns correct course count per group', () => {
    const courses: Course[] = [
      { id: 'c1', semester: 'spring2026' },
      { id: 'c2', semester: 'spring2026' },
      { id: 'c3', semester: 'fall2026' },
    ]
    const result = groupBySemester(courses)
    expect(result).toHaveLength(2)
    const spring = result.find(g => g.semester === 'spring2026')!
    expect(spring.courses).toHaveLength(2)
  })
})
