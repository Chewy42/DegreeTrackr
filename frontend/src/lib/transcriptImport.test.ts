// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { importTranscript, type EvaluationStore, type TranscriptCourse } from './transcriptImport'

const EMPTY_STORE: EvaluationStore = { courses: [], gpa: null }

const COURSE_A: TranscriptCourse = {
  courseId: 'CS101', title: 'Intro to CS', credits: 3, grade: 'A', gradePoints: 4.0,
}
const COURSE_B: TranscriptCourse = {
  courseId: 'MATH150', title: 'Calculus I', credits: 4, grade: 'B', gradePoints: 3.0,
}

function toJson(courses: TranscriptCourse[]) {
  return JSON.stringify({ courses })
}

describe('importTranscript', () => {
  it('imports courses from valid JSON into an empty store', () => {
    const result = importTranscript(toJson([COURSE_A]), EMPTY_STORE)
    expect(result.courses).toHaveLength(1)
    expect(result.courses[0].courseId).toBe('CS101')
  })

  it('computes GPA from imported courses', () => {
    const result = importTranscript(toJson([COURSE_A, COURSE_B]), EMPTY_STORE)
    // A × 3 credits = 12.0, B × 4 credits = 12.0 → (24/7) ≈ 3.43
    expect(result.gpa).not.toBeNull()
    expect(result.gpa!).toBeCloseTo(24 / 7, 3)
  })

  it('returns gpa=null for empty courses array', () => {
    const result = importTranscript(toJson([]), EMPTY_STORE)
    expect(result.gpa).toBeNull()
  })

  it('throws on malformed JSON', () => {
    expect(() => importTranscript('{not json}', EMPTY_STORE)).toThrow(/malformed/i)
  })

  it('throws when courses array is missing', () => {
    expect(() => importTranscript(JSON.stringify({ no_courses: true }), EMPTY_STORE)).toThrow(/malformed/i)
  })

  it('is idempotent: re-importing same transcript replaces courses without duplicates', () => {
    const json = toJson([COURSE_A])
    const first = importTranscript(json, EMPTY_STORE)
    const second = importTranscript(json, first)
    expect(second.courses).toHaveLength(1)
    expect(second.courses[0].courseId).toBe('CS101')
  })

  it('replaces an existing course with updated data on re-import', () => {
    const initial = importTranscript(toJson([COURSE_A]), EMPTY_STORE)
    const updated: TranscriptCourse = { ...COURSE_A, grade: 'A+', gradePoints: 4.0 }
    const result = importTranscript(toJson([updated]), initial)
    expect(result.courses).toHaveLength(1)
    expect(result.courses[0].grade).toBe('A+')
  })

  it('preserves existing courses not in the new transcript', () => {
    const initial = importTranscript(toJson([COURSE_A]), EMPTY_STORE)
    const result = importTranscript(toJson([COURSE_B]), initial)
    expect(result.courses).toHaveLength(2)
    expect(result.courses.some(c => c.courseId === 'CS101')).toBe(true)
    expect(result.courses.some(c => c.courseId === 'MATH150')).toBe(true)
  })
})
