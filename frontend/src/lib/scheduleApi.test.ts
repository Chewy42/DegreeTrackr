import { describe, expect, it } from 'vitest'

import type { ProgramEvaluationPayload } from './convex'
import type { ClassSection } from '../components/schedule/types'
import {
  deriveRequirementsSummaryFromProgramEvaluation,
  validateScheduledClassesLocally,
} from './scheduleApi'

function makeClass(overrides: Partial<ClassSection>): ClassSection {
  return {
    id: 'CPSC-350-01',
    code: 'CPSC 350-01',
    subject: 'CPSC',
    number: '350',
    section: '01',
    title: 'Software Design',
    credits: 3,
    displayDays: 'MWF',
    displayTime: '10:00 AM - 10:50 AM',
    location: 'Keck 101',
    professor: 'Prof. Example',
    professorRating: null,
    semester: 'spring2026',
    semestersOffered: ['Spring'],
    occurrenceData: {
      starts: 0,
      ends: 0,
      daysOccurring: {
        M: [{ startTime: 600, endTime: 650 }],
        Tu: [],
        W: [{ startTime: 600, endTime: 650 }],
        Th: [],
        F: [{ startTime: 600, endTime: 650 }],
        Sa: [],
        Su: [],
      },
    },
    requirementsSatisfied: [],
    ...overrides,
  }
}

describe('deriveRequirementsSummaryFromProgramEvaluation', () => {
  it('maps parsed credit requirements into schedule impact requirements', () => {
    const payload: ProgramEvaluationPayload = {
      parsed_data: {
        credit_requirements: [
          { label: 'Major Core', needed: 9 },
          { label: 'General Education', needed: 3 },
        ],
      },
    }

    expect(deriveRequirementsSummaryFromProgramEvaluation(payload)).toEqual({
      total: 12,
      byType: {
        major_core: 9,
        ge: 3,
      },
      requirements: [
        { type: 'major_core', label: 'Major Core', creditsNeeded: 9 },
        { type: 'ge', label: 'General Education', creditsNeeded: 3 },
      ],
    })
  })

  it('returns null when no credit requirements are available', () => {
    expect(deriveRequirementsSummaryFromProgramEvaluation(null)).toBeNull()
  })
})

describe('validateScheduledClassesLocally', () => {
  it('detects overlapping classes and totals credits', () => {
    const a = makeClass({ id: 'A', code: 'A', credits: 4 })
    const b = makeClass({
      id: 'B',
      code: 'B',
      credits: 3,
      occurrenceData: {
        starts: 0,
        ends: 0,
        daysOccurring: {
          M: [{ startTime: 630, endTime: 700 }],
          Tu: [],
          W: [{ startTime: 630, endTime: 700 }],
          Th: [],
          F: [],
          Sa: [],
          Su: [],
        },
      },
    })

    const result = validateScheduledClassesLocally([a, b])

    expect(result.valid).toBe(false)
    expect(result.totalCredits).toBe(7)
    expect(result.conflicts).toHaveLength(2)
    expect(result.conflicts[0]?.classId1).toBe('A')
    expect(result.conflicts[0]?.classId2).toBe('B')
  })

  it('adds a heavy-load warning above 18 credits', () => {
    const classes = Array.from({ length: 7 }, (_, index) =>
      makeClass({ id: `C${index}`, code: `C${index}`, credits: 3, occurrenceData: {
        starts: 0,
        ends: 0,
        daysOccurring: { M: [], Tu: [], W: [], Th: [], F: [], Sa: [], Su: [] },
      } }),
    )

    const result = validateScheduledClassesLocally(classes)

    expect(result.totalCredits).toBe(21)
    expect(result.warnings).toContain('Heavy schedule: more than 18 credits may be difficult to manage.')
  })
})
