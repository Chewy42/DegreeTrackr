// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { getCurrentSemester } from './academicCalendar'

describe('getCurrentSemester', () => {
  it('returns Spring for January', () => {
    expect(getCurrentSemester(new Date('2026-01-15'))).toBe('Spring 2026')
  })

  it('returns Spring for March', () => {
    expect(getCurrentSemester(new Date('2026-03-01'))).toBe('Spring 2026')
  })

  it('returns Spring for May 15 (boundary)', () => {
    expect(getCurrentSemester(new Date('2026-05-15'))).toBe('Spring 2026')
  })

  it('returns Summer for May 16 (UTC noon)', () => {
    expect(getCurrentSemester(new Date('2026-05-16T12:00:00Z'))).toBe('Summer 2026')
  })

  it('returns Summer for July', () => {
    expect(getCurrentSemester(new Date('2026-07-01'))).toBe('Summer 2026')
  })

  it('returns Summer for August 15 (boundary)', () => {
    expect(getCurrentSemester(new Date('2026-08-15'))).toBe('Summer 2026')
  })

  it('returns Fall for August 16 (UTC noon to avoid tz issues)', () => {
    // Use noon UTC to avoid local-timezone boundary shifts on Aug 16
    expect(getCurrentSemester(new Date('2026-08-16T12:00:00Z'))).toBe('Fall 2026')
  })

  it('returns Fall for September', () => {
    expect(getCurrentSemester(new Date('2026-09-01T12:00:00Z'))).toBe('Fall 2026')
  })

  it('returns Fall for December', () => {
    expect(getCurrentSemester(new Date('2026-12-31T12:00:00Z'))).toBe('Fall 2026')
  })

  it('uses correct year for Fall', () => {
    expect(getCurrentSemester(new Date('2025-11-01'))).toBe('Fall 2025')
  })

  it('uses correct year for Spring', () => {
    expect(getCurrentSemester(new Date('2027-02-01'))).toBe('Spring 2027')
  })
})
