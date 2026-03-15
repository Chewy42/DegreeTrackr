import { describe, expect, it } from 'vitest'
import { importTranscript, type EvaluationStore } from '../lib/transcriptImport'

function emptyStore(): EvaluationStore {
  return { courses: [], gpa: null }
}

function makeTranscript(courses: Array<{ courseId: string; title: string; credits: number; grade: string; gradePoints: number }>) {
  return JSON.stringify({ courses })
}

describe('Transcript import — DT159', () => {
  it('import JSON with 5 courses → all 5 stored', () => {
    const json = makeTranscript([
      { courseId: 'CS101', title: 'Intro CS', credits: 3, grade: 'A', gradePoints: 4.0 },
      { courseId: 'CS201', title: 'Data Structures', credits: 3, grade: 'B+', gradePoints: 3.3 },
      { courseId: 'MATH150', title: 'Calculus I', credits: 4, grade: 'A-', gradePoints: 3.7 },
      { courseId: 'ENG100', title: 'Composition', credits: 3, grade: 'B', gradePoints: 3.0 },
      { courseId: 'PHYS200', title: 'Physics I', credits: 4, grade: 'A', gradePoints: 4.0 },
    ])
    const result = importTranscript(json, emptyStore())
    expect(result.courses).toHaveLength(5)
    expect(result.courses.map((c) => c.courseId)).toEqual([
      'CS101', 'CS201', 'MATH150', 'ENG100', 'PHYS200',
    ])
  })

  it('GPA calculated from imported courses (3.5 average → GPA ≈ 3.5)', () => {
    const json = makeTranscript([
      { courseId: 'A', title: 'A', credits: 3, grade: 'A', gradePoints: 4.0 },
      { courseId: 'B', title: 'B', credits: 3, grade: 'B', gradePoints: 3.0 },
    ])
    const result = importTranscript(json, emptyStore())
    expect(result.gpa).toBeCloseTo(3.5, 2)
  })

  it('duplicate import (same transcript) → idempotent (no duplicates)', () => {
    const json = makeTranscript([
      { courseId: 'CS101', title: 'Intro CS', credits: 3, grade: 'A', gradePoints: 4.0 },
      { courseId: 'CS201', title: 'Data Structures', credits: 3, grade: 'B', gradePoints: 3.0 },
    ])
    const first = importTranscript(json, emptyStore())
    const second = importTranscript(json, first)
    expect(second.courses).toHaveLength(2)
  })

  it('malformed JSON → throws with clear error message', () => {
    expect(() => importTranscript('{bad json', emptyStore())).toThrow('Malformed transcript JSON')
    expect(() => importTranscript('{"courses": "not-array"}', emptyStore())).toThrow('Malformed transcript JSON')
  })

  it('empty transcript → stores 0 courses, no crash', () => {
    const json = makeTranscript([])
    const result = importTranscript(json, emptyStore())
    expect(result.courses).toHaveLength(0)
    expect(result.gpa).toBeNull()
  })
})
