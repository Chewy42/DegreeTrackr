import { describe, expect, it } from 'vitest'
import { exportAsJSON, exportAsCSV } from '../lib/scheduleExport'
import type { ExportableClass } from '../lib/scheduleExport'

// ── Fixture: 3-class schedule with specific day/time/credits ───────────────

const threeClassSchedule: ExportableClass[] = [
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
    code: 'PHYS 201-02',
    title: 'Physics II',
    credits: 4,
    displayDays: 'MWF',
    displayTime: '2:00pm - 2:50pm',
    professor: 'Lee',
  },
]

// ── JSON roundtrip ─────────────────────────────────────────────────────────

describe('schedule JSON export → parse roundtrip', () => {
  it('export → JSON.stringify → JSON.parse preserves all 3 classes with correct fields', () => {
    const exported = exportAsJSON(threeClassSchedule)
    const serialized = JSON.stringify(exported)
    const parsed = JSON.parse(serialized)

    expect(parsed).toHaveLength(3)

    // Verify each class has correct name, credits, days, times
    expect(parsed[0]).toEqual({
      code: 'CPSC 350-03',
      className: 'Software Engineering',
      days: 'MWF',
      startTime: '10:00am',
      endTime: '10:50am',
      credits: 3,
      instructor: 'Smith',
    })

    expect(parsed[1]).toEqual({
      code: 'MATH 240-01',
      className: 'Linear Algebra',
      days: 'TR',
      startTime: '1:00pm',
      endTime: '2:15pm',
      credits: 4,
      instructor: 'Jones',
    })

    expect(parsed[2]).toEqual({
      code: 'PHYS 201-02',
      className: 'Physics II',
      days: 'MWF',
      startTime: '2:00pm',
      endTime: '2:50pm',
      credits: 4,
      instructor: 'Lee',
    })
  })

  it('empty schedule → JSON export → parse → empty array (not null/undefined)', () => {
    const exported = exportAsJSON([])
    const serialized = JSON.stringify(exported)
    const parsed = JSON.parse(serialized)

    expect(parsed).toEqual([])
    expect(parsed).not.toBeNull()
    expect(parsed).toBeDefined()
    expect(Array.isArray(parsed)).toBe(true)
  })
})

// ── CSV roundtrip ──────────────────────────────────────────────────────────

describe('schedule CSV export → parse roundtrip', () => {
  it('export → split lines → header has correct columns → each row matches a class', () => {
    const csv = exportAsCSV(threeClassSchedule)
    const lines = csv.split('\n')

    // Header + 3 data rows
    expect(lines).toHaveLength(4)

    // Verify header row columns
    const header = lines[0]!
    expect(header).toBe('Class,Days,StartTime,EndTime,Credits,Instructor')
    const headerCols = header.split(',')
    expect(headerCols).toEqual(['Class', 'Days', 'StartTime', 'EndTime', 'Credits', 'Instructor'])

    // Verify each data row matches its class
    expect(lines[1]).toContain('CPSC 350-03 - Software Engineering')
    expect(lines[1]).toContain('MWF')
    expect(lines[1]).toContain('10:00am')
    expect(lines[1]).toContain('10:50am')
    expect(lines[1]).toContain('3')
    expect(lines[1]).toContain('Smith')

    expect(lines[2]).toContain('MATH 240-01 - Linear Algebra')
    expect(lines[2]).toContain('TR')
    expect(lines[2]).toContain('1:00pm')
    expect(lines[2]).toContain('2:15pm')
    expect(lines[2]).toContain('4')
    expect(lines[2]).toContain('Jones')

    expect(lines[3]).toContain('PHYS 201-02 - Physics II')
    expect(lines[3]).toContain('MWF')
    expect(lines[3]).toContain('2:00pm')
    expect(lines[3]).toContain('2:50pm')
    expect(lines[3]).toContain('4')
    expect(lines[3]).toContain('Lee')
  })

  it('empty schedule → CSV export → only header row, no data rows', () => {
    const csv = exportAsCSV([])
    const lines = csv.split('\n')

    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe('Class,Days,StartTime,EndTime,Credits,Instructor')
  })
})

// ── Special character edge cases ──────────────────────────────────────────

describe('schedule export special character handling', () => {
  it('CSV: course name with commas is properly quoted', () => {
    const classWithComma: ExportableClass = {
      code: 'HIST 300',
      title: 'War, Peace, and Diplomacy',
      credits: 3,
      displayDays: 'MWF',
      displayTime: '2:00pm - 2:50pm',
      professor: "O'Brien",
    }

    const csv = exportAsCSV([classWithComma])
    const lines = csv.split('\n')
    // Class field is wrapped in quotes by exportAsCSV, so commas are safe
    expect(lines[1]).toContain('"HIST 300 - War, Peace, and Diplomacy"')
  })

  it('CSV: course with double quotes in title', () => {
    const classWithQuotes: ExportableClass = {
      code: 'ENG 450',
      title: 'The "Lost Generation" in Literature',
      credits: 3,
      displayDays: 'TuTh',
      displayTime: '11:00am - 12:15pm',
      professor: 'Dr. Smith',
    }

    const csv = exportAsCSV([classWithQuotes])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('ENG 450')
    expect(lines[1]).toContain('Lost Generation')
  })

  it('JSON: special characters preserved verbatim', () => {
    const classWithSpecial: ExportableClass = {
      code: 'MATH 301',
      title: 'Algebra, Groups & "Rings"',
      credits: 4,
      displayDays: 'MWF',
      displayTime: '3:00pm - 3:50pm',
      professor: "O'Connor",
    }

    const json = exportAsJSON([classWithSpecial])
    expect(json[0].className).toBe('Algebra, Groups & "Rings"')
    expect(json[0].instructor).toBe("O'Connor")
  })
})
