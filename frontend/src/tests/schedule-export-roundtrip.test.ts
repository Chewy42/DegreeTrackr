import { describe, it, expect } from 'vitest'
import { exportAsJSON } from '../lib/scheduleExport'
import type { ExportableClass, ExportedClassJSON } from '../lib/scheduleExport'

const COURSES: ExportableClass[] = [
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

/** Simulate JSON serialization roundtrip (export → stringify → parse). */
function roundtrip(classes: ExportableClass[]): ExportedClassJSON[] {
  const exported = exportAsJSON(classes)
  const serialized = JSON.stringify(exported)
  return JSON.parse(serialized) as ExportedClassJSON[]
}

describe('Schedule export roundtrip', () => {
  it('export 3 courses to JSON → JSON contains all 3 course codes', () => {
    const json = exportAsJSON(COURSES)
    expect(json).toHaveLength(3)

    const codes = json.map((c) => c.code)
    expect(codes).toContain('CPSC 350-03')
    expect(codes).toContain('MATH 240-01')
    expect(codes).toContain('ENGL 110-02')
  })

  it('parsed exported JSON matches expected schema fields', () => {
    const parsed = roundtrip(COURSES)
    const expectedKeys: (keyof ExportedClassJSON)[] = [
      'code', 'className', 'days', 'startTime', 'endTime', 'credits', 'instructor',
    ]

    for (const entry of parsed) {
      for (const key of expectedKeys) {
        expect(entry).toHaveProperty(key)
      }
      expect(typeof entry.code).toBe('string')
      expect(typeof entry.credits).toBe('number')
    }
  })

  it('export empty schedule → empty JSON array', () => {
    const json = exportAsJSON([])
    expect(json).toEqual([])

    const parsed = roundtrip([])
    expect(parsed).toEqual([])
  })

  it('roundtrip preserves all course data after import', () => {
    const imported = roundtrip(COURSES)

    expect(imported[0]).toEqual({
      code: 'CPSC 350-03',
      className: 'Software Engineering',
      days: 'MWF',
      startTime: '10:00am',
      endTime: '10:50am',
      credits: 3,
      instructor: 'Smith',
    })

    expect(imported[1]?.code).toBe('MATH 240-01')
    expect(imported[2]?.code).toBe('ENGL 110-02')
  })

  it('imported course count matches original', () => {
    const imported = roundtrip(COURSES)
    expect(imported).toHaveLength(COURSES.length)

    // Also verify with different sizes
    expect(roundtrip(COURSES.slice(0, 1))).toHaveLength(1)
    expect(roundtrip(COURSES.slice(0, 2))).toHaveLength(2)
  })
})
