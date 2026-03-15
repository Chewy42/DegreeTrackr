// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { exportAsJSON, exportAsCSV, type ExportableClass } from './scheduleExport'

const CLASSES: ExportableClass[] = [
  {
    code: 'CS101',
    title: 'Intro to CS',
    credits: 3,
    displayDays: 'MWF',
    displayTime: '9:00am - 9:50am',
    professor: 'Dr. Smith',
  },
  {
    code: 'MATH150',
    title: 'Calculus I',
    credits: 4,
    displayDays: 'TuTh',
    displayTime: '10:00am - 11:15am',
    professor: 'Prof. Jones',
  },
]

describe('exportAsJSON', () => {
  it('returns empty array for empty input', () => {
    expect(exportAsJSON([])).toEqual([])
  })

  it('returns one item per class', () => {
    expect(exportAsJSON(CLASSES)).toHaveLength(2)
  })

  it('maps code correctly', () => {
    const result = exportAsJSON(CLASSES)
    expect(result[0].code).toBe('CS101')
  })

  it('maps title to className', () => {
    const result = exportAsJSON(CLASSES)
    expect(result[0].className).toBe('Intro to CS')
  })

  it('maps displayDays to days', () => {
    const result = exportAsJSON(CLASSES)
    expect(result[0].days).toBe('MWF')
  })

  it('splits displayTime into startTime and endTime', () => {
    const result = exportAsJSON(CLASSES)
    expect(result[0].startTime).toBe('9:00am')
    expect(result[0].endTime).toBe('9:50am')
  })

  it('maps credits correctly', () => {
    const result = exportAsJSON(CLASSES)
    expect(result[1].credits).toBe(4)
  })

  it('maps professor to instructor', () => {
    const result = exportAsJSON(CLASSES)
    expect(result[0].instructor).toBe('Dr. Smith')
  })
})

describe('exportAsCSV', () => {
  it('returns only header for empty input', () => {
    const csv = exportAsCSV([])
    expect(csv).toBe('Class,Days,StartTime,EndTime,Credits,Instructor')
  })

  it('returns header + one row per class', () => {
    const csv = exportAsCSV(CLASSES)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3) // header + 2 rows
  })

  it('first line is the header', () => {
    const csv = exportAsCSV(CLASSES)
    expect(csv.split('\n')[0]).toBe('Class,Days,StartTime,EndTime,Credits,Instructor')
  })

  it('data row contains class code and title', () => {
    const csv = exportAsCSV(CLASSES)
    expect(csv).toContain('CS101')
    expect(csv).toContain('Intro to CS')
  })

  it('data row contains days', () => {
    const csv = exportAsCSV(CLASSES)
    expect(csv).toContain('MWF')
  })

  it('data row contains instructor', () => {
    const csv = exportAsCSV(CLASSES)
    expect(csv).toContain('Dr. Smith')
  })
})
