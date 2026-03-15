import { describe, expect, it } from 'vitest'
import { groupBySemester } from '../lib/semesterGrouping'

function course(id: string, semester: string) {
  return { id, semester }
}

describe('Multi-semester grouping — DT155', () => {
  it('3 Fall + 3 Spring → 2 groups', () => {
    const courses = [
      course('C1', 'fall2025'), course('C2', 'fall2025'), course('C3', 'fall2025'),
      course('C4', 'spring2026'), course('C5', 'spring2026'), course('C6', 'spring2026'),
    ]
    const groups = groupBySemester(courses)
    expect(groups).toHaveLength(2)
  })

  it('Fall group contains the 3 Fall courses, Spring group the 3 Spring', () => {
    const courses = [
      course('C1', 'fall2025'), course('C2', 'fall2025'), course('C3', 'fall2025'),
      course('C4', 'spring2026'), course('C5', 'spring2026'), course('C6', 'spring2026'),
    ]
    const groups = groupBySemester(courses)
    const fall = groups.find(g => g.semester === 'fall2025')!
    const spring = groups.find(g => g.semester === 'spring2026')!
    expect(fall.courses.map(c => c.id)).toEqual(['C1', 'C2', 'C3'])
    expect(spring.courses.map(c => c.id)).toEqual(['C4', 'C5', 'C6'])
  })

  it('Fall comes before Spring of the next year in sort order', () => {
    const courses = [
      course('S1', 'spring2026'),
      course('F1', 'fall2025'),
    ]
    const groups = groupBySemester(courses)
    expect(groups[0].semester).toBe('fall2025')
    expect(groups[1].semester).toBe('spring2026')
  })

  it('empty schedule → empty groups (no crash)', () => {
    const groups = groupBySemester([])
    expect(groups).toEqual([])
  })

  it('Fall 2024 and Fall 2025 → separate groups', () => {
    const courses = [
      course('A', 'fall2024'),
      course('B', 'fall2025'),
    ]
    const groups = groupBySemester(courses)
    expect(groups).toHaveLength(2)
    expect(groups[0].semester).toBe('fall2024')
    expect(groups[1].semester).toBe('fall2025')
  })
})
