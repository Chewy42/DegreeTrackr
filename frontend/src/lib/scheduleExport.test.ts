import { describe, it, expect } from 'vitest'
import { exportAsJSON, exportAsCSV } from './scheduleExport'
import type { ExportableClass } from './scheduleExport'

const mockClasses: ExportableClass[] = [
  {
    code: 'CPSC 350-03',
    title: 'Software Engineering',
    credits: 3,
    displayDays: 'MWF',
    displayTime: '10:00am - 10:50am',
    professor: 'Smith',
  },
  {
    code: 'MATH 240-01',
    title: 'Linear Algebra',
    credits: 4,
    displayDays: 'TR',
    displayTime: '1:00pm - 2:15pm',
    professor: 'Jones',
  },
  {
    code: 'ENGL 110-02',
    title: 'Composition',
    credits: 3,
    displayDays: 'MWF',
    displayTime: '9:00am - 9:50am',
    professor: 'Davis',
  },
]

// ── exportAsJSON ─────────────────────────────────────────────────────────────

describe('exportAsJSON', () => {
  it('returns correct structure for 3 classes', () => {
    const result = exportAsJSON(mockClasses)

    expect(result).toHaveLength(3)

    expect(result[0]).toEqual({
      code: 'CPSC 350-03',
      className: 'Software Engineering',
      days: 'MWF',
      startTime: '10:00am',
      endTime: '10:50am',
      credits: 3,
      instructor: 'Smith',
    })

    expect(result[1]).toEqual({
      code: 'MATH 240-01',
      className: 'Linear Algebra',
      days: 'TR',
      startTime: '1:00pm',
      endTime: '2:15pm',
      credits: 4,
      instructor: 'Jones',
    })

    expect(result[2]).toEqual({
      code: 'ENGL 110-02',
      className: 'Composition',
      days: 'MWF',
      startTime: '9:00am',
      endTime: '9:50am',
      credits: 3,
      instructor: 'Davis',
    })
  })

  it('returns empty array for empty schedule', () => {
    expect(exportAsJSON([])).toEqual([])
  })
})

// ── exportAsCSV ──────────────────────────────────────────────────────────────

describe('exportAsCSV', () => {
  it('returns header row + 3 data rows', () => {
    const result = exportAsCSV(mockClasses)
    const lines = result.split('\n')

    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe('Class,Days,StartTime,EndTime,Credits,Instructor')

    expect(lines[1]).toBe('"CPSC 350-03 - Software Engineering","MWF","10:00am","10:50am",3,"Smith"')
    expect(lines[2]).toBe('"MATH 240-01 - Linear Algebra","TR","1:00pm","2:15pm",4,"Jones"')
    expect(lines[3]).toBe('"ENGL 110-02 - Composition","MWF","9:00am","9:50am",3,"Davis"')
  })

  it('returns only header for empty schedule', () => {
    const result = exportAsCSV([])
    expect(result).toBe('Class,Days,StartTime,EndTime,Credits,Instructor')
  })
})

// ── edge cases ───────────────────────────────────────────────────────────────

describe('handles classes with no time separator gracefully', () => {
  it('does not crash and defaults startTime/endTime to empty strings', () => {
    const tbaClass: ExportableClass = {
      code: 'CPSC 499-01',
      title: 'Independent Study',
      credits: 3,
      displayDays: 'TBA',
      displayTime: 'TBA',
      professor: 'Staff',
    }

    const jsonResult = exportAsJSON([tbaClass])
    expect(jsonResult).toHaveLength(1)
    expect(jsonResult[0]?.startTime).toBe('TBA')
    expect(jsonResult[0]?.endTime).toBe('')

    const csvResult = exportAsCSV([tbaClass])
    const lines = csvResult.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('"TBA"')
  })
})
