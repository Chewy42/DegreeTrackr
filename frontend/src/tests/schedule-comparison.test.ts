import { describe, it, expect } from 'vitest'

type ScheduleCourse = { code: string }

type DiffEntry = { code: string; status: 'added' | 'removed' }

/** Compute courses added/removed between two schedule snapshots by course code. */
function diffSchedules(a: ScheduleCourse[], b: ScheduleCourse[]): DiffEntry[] {
  const codesA = new Set(a.map((c) => c.code))
  const codesB = new Set(b.map((c) => c.code))

  const diff: DiffEntry[] = []
  for (const code of codesB) {
    if (!codesA.has(code)) diff.push({ code, status: 'added' })
  }
  for (const code of codesA) {
    if (!codesB.has(code)) diff.push({ code, status: 'removed' })
  }
  return diff
}

describe('Schedule snapshot comparison', () => {
  const scheduleA: ScheduleCourse[] = [{ code: 'CS101' }, { code: 'MATH201' }]

  const scheduleB: ScheduleCourse[] = [
    { code: 'CS101' },
    { code: 'ENG301' },
    { code: 'MATH201' },
  ]

  const scheduleC: ScheduleCourse[] = [{ code: 'CS101' }]

  it('detects ENG301 as added when comparing A → B', () => {
    const diff = diffSchedules(scheduleA, scheduleB)
    expect(diff).toEqual([{ code: 'ENG301', status: 'added' }])
  })

  it('detects MATH201 as removed when comparing A → C', () => {
    const diff = diffSchedules(scheduleA, scheduleC)
    expect(diff).toEqual([{ code: 'MATH201', status: 'removed' }])
  })

  it('returns empty diff when comparing a schedule to itself', () => {
    const diff = diffSchedules(scheduleA, scheduleA)
    expect(diff).toEqual([])
  })

  it('shows both added and removed in a single diff', () => {
    // B has ENG301 that C lacks; C lacks MATH201 that B has
    const diff = diffSchedules(scheduleB, scheduleC)
    expect(diff).toContainEqual({ code: 'ENG301', status: 'removed' })
    expect(diff).toContainEqual({ code: 'MATH201', status: 'removed' })
    expect(diff).toHaveLength(2)
  })

  it('handles empty schedule as base', () => {
    const diff = diffSchedules([], scheduleA)
    expect(diff).toEqual([
      { code: 'CS101', status: 'added' },
      { code: 'MATH201', status: 'added' },
    ])
  })
})
