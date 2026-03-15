import { describe, expect, it } from 'vitest'
import { gradeValue } from '../lib/progressUtils'
import { importTranscript } from '../lib/transcriptImport'
import type { EvaluationStore } from '../lib/transcriptImport'

const EMPTY_STORE: EvaluationStore = { courses: [], gpa: null }

describe('contracts validation — DT192', () => {
  it('valid courseId format accepted (e.g. "CS-101")', () => {
    const json = JSON.stringify({
      courses: [{ courseId: 'CS-101', title: 'Intro', credits: 3, grade: 'A', gradePoints: 4.0 }],
    })
    const store = importTranscript(json, EMPTY_STORE)
    expect(store.courses).toHaveLength(1)
    expect(store.courses[0]!.courseId).toBe('CS-101')
  })

  it('credits value of 0 produces a 0-credit course (no GPA contribution)', () => {
    const json = JSON.stringify({
      courses: [{ courseId: 'ZERO-100', title: 'Seminar', credits: 0, grade: 'A', gradePoints: 4.0 }],
    })
    const store = importTranscript(json, EMPTY_STORE)
    expect(store.courses[0]!.credits).toBe(0)
    // GPA null because 0 total credits
    expect(store.gpa).toBeNull()
  })

  it('grade value not in standard enum returns -1 (unrecognised)', () => {
    expect(gradeValue('X')).toBe(-1)
    expect(gradeValue('Z+')).toBe(-1)
    expect(gradeValue('')).toBe(-1)
  })

  it('missing courses array in transcript JSON throws with clear message', () => {
    expect(() => importTranscript('{}', EMPTY_STORE)).toThrow(
      'Malformed transcript JSON: missing courses array',
    )
    expect(() => importTranscript('{"courses": "not-array"}', EMPTY_STORE)).toThrow(
      'Malformed transcript JSON: missing courses array',
    )
  })
})
