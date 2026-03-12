import { describe, expect, it } from 'vitest'

import { deriveUpcomingClassesFromProgramEvaluation } from './ExploreClassesSidebar'
import type { ProgramEvaluationPayload } from '../lib/convex'

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
})
