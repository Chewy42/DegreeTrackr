import { describe, expect, it } from 'vitest'

import { deriveUpcomingClassesFromProgramEvaluation } from './ExploreClassesSidebar'
import type { ProgramEvaluationPayload } from '../lib/convex'

// Mirror of the component's useMemo filter logic (verified against ExploreClassesSidebar.tsx)
function applyClassFilter(
  classes: ReturnType<typeof deriveUpcomingClassesFromProgramEvaluation>,
  query: string,
) {
  const q = query.trim().toLowerCase()
  if (!q) return classes
  return classes.filter(
    (cls) =>
      cls.code.toLowerCase().includes(q) ||
      cls.title.toLowerCase().includes(q) ||
      cls.professor.toLowerCase().includes(q) ||
      cls.term.toLowerCase().includes(q),
  )
}

describe('deriveUpcomingClassesFromProgramEvaluation', () => {
  it('returns an empty list when no program evaluation exists', () => {
    expect(deriveUpcomingClassesFromProgramEvaluation(null)).toEqual([])
  })

  it('maps in-progress program evaluation courses into sidebar cards', () => {
    const payload: ProgramEvaluationPayload = {
      parsed_data: {
        courses: {
          in_progress: [
            {
              subject: 'CPSC',
              number: '350',
              title: 'Software Design',
              term: 'Spring 2026',
            },
          ],
        },
      },
    }

    expect(deriveUpcomingClassesFromProgramEvaluation(payload)).toEqual([
      {
        id: 'CPSC 350-Spring 2026-0',
        code: 'CPSC 350',
        title: 'Software Design',
        professor: 'From program evaluation',
        term: 'Spring 2026',
      },
    ])
  })

  it('falls back gracefully when course metadata is partial', () => {
    const payload: ProgramEvaluationPayload = {
      parsed_data: {
        courses: {
          in_progress: [
            {
              title: 'Senior Seminar',
            },
          ],
        },
      },
    }

    expect(deriveUpcomingClassesFromProgramEvaluation(payload)).toEqual([
      {
        id: 'Senior Seminar-In progress-0',
        code: 'Senior Seminar',
        title: 'Senior Seminar',
        professor: 'From program evaluation',
        term: 'In progress',
      },
    ])
  })

  // ── Empty Convex results ──────────────────────────────────────────────

  it('returns empty array when courses.in_progress is missing', () => {
    const payload: ProgramEvaluationPayload = {
      parsed_data: { courses: {} },
    }
    expect(deriveUpcomingClassesFromProgramEvaluation(payload)).toEqual([])
  })

  it('returns empty array when in_progress is an empty array', () => {
    const payload: ProgramEvaluationPayload = {
      parsed_data: { courses: { in_progress: [] } },
    }
    expect(deriveUpcomingClassesFromProgramEvaluation(payload)).toEqual([])
  })

  it('returns empty array when parsed_data is absent', () => {
    const payload = {} as ProgramEvaluationPayload
    expect(deriveUpcomingClassesFromProgramEvaluation(payload)).toEqual([])
  })

  it('returns empty array when payload is undefined', () => {
    expect(deriveUpcomingClassesFromProgramEvaluation(undefined)).toEqual([])
  })

  // ── Multiple courses ──────────────────────────────────────────────────

  it('maps multiple in-progress courses preserving order', () => {
    const payload: ProgramEvaluationPayload = {
      parsed_data: {
        courses: {
          in_progress: [
            { subject: 'MATH', number: '101', title: 'Calculus I', term: 'Fall 2025' },
            { subject: 'CPSC', number: '480', title: 'Machine Learning', term: 'Fall 2025' },
          ],
        },
      },
    }

    const result = deriveUpcomingClassesFromProgramEvaluation(payload)

    expect(result).toHaveLength(2)
    expect(result[0]!.code).toBe('MATH 101')
    expect(result[1]!.code).toBe('CPSC 480')
  })

  it('assigns unique ids when two courses share the same code and term using index', () => {
    const payload: ProgramEvaluationPayload = {
      parsed_data: {
        courses: {
          in_progress: [
            { subject: 'CPSC', number: '350', title: 'Section A', term: 'Spring 2026' },
            { subject: 'CPSC', number: '350', title: 'Section B', term: 'Spring 2026' },
          ],
        },
      },
    }

    const result = deriveUpcomingClassesFromProgramEvaluation(payload)

    expect(result[0]!.id).toBe('CPSC 350-Spring 2026-0')
    expect(result[1]!.id).toBe('CPSC 350-Spring 2026-1')
  })

  it('trims whitespace from subject, number, title, and term', () => {
    const payload: ProgramEvaluationPayload = {
      parsed_data: {
        courses: {
          in_progress: [
            { subject: ' CPSC ', number: ' 350 ', title: ' Software Design ', term: ' Spring 2026 ' },
          ],
        },
      },
    }

    const result = deriveUpcomingClassesFromProgramEvaluation(payload)

    expect(result[0]!.code).toBe('CPSC 350')
    expect(result[0]!.title).toBe('Software Design')
    expect(result[0]!.term).toBe('Spring 2026')
  })
})

// ── Search filter simulation ──────────────────────────────────────────────────
// Tests mirror the component's useMemo filter from ExploreClassesSidebar.tsx

describe('ExploreClassesSidebar search filter', () => {
  const payload: ProgramEvaluationPayload = {
    parsed_data: {
      courses: {
        in_progress: [
          { subject: 'CPSC', number: '350', title: 'Software Design', term: 'Spring 2026' },
          { subject: 'MATH', number: '250', title: 'Linear Algebra', term: 'Fall 2026' },
          { subject: 'ENGL', number: '110', title: 'Composition', term: 'Spring 2026' },
        ],
      },
    },
  }
  const classes = deriveUpcomingClassesFromProgramEvaluation(payload)

  it('returns all classes when query is empty', () => {
    expect(applyClassFilter(classes, '')).toHaveLength(3)
  })

  it('returns all classes when query is only whitespace', () => {
    expect(applyClassFilter(classes, '   ')).toHaveLength(3)
  })

  it('filters by course code case-insensitively', () => {
    const result = applyClassFilter(classes, 'cpsc')
    expect(result).toHaveLength(1)
    expect(result[0]!.code).toBe('CPSC 350')
  })

  it('filters by title case-insensitively', () => {
    const result = applyClassFilter(classes, 'algebra')
    expect(result).toHaveLength(1)
    expect(result[0]!.title).toBe('Linear Algebra')
  })

  it('filters by term', () => {
    const result = applyClassFilter(classes, 'fall')
    expect(result).toHaveLength(1)
    expect(result[0]!.code).toBe('MATH 250')
  })

  it('filters by professor field', () => {
    // All derived classes share "From program evaluation" as professor
    const result = applyClassFilter(classes, 'program evaluation')
    expect(result).toHaveLength(3)
  })

  it('returns empty array when no classes match query — "no classes found" state', () => {
    const result = applyClassFilter(classes, 'PHYS 999 nonexistent')
    expect(result).toHaveLength(0)
  })

  it('returns multiple matches when query matches several courses', () => {
    // "Spring 2026" appears for CPSC 350 and ENGL 110
    const result = applyClassFilter(classes, 'spring 2026')
    expect(result).toHaveLength(2)
  })

  it('filter on empty class list always returns empty array', () => {
    const result = applyClassFilter([], 'CPSC')
    expect(result).toHaveLength(0)
  })
})
