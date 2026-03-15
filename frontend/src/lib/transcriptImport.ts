/**
 * Transcript JSON import utilities.
 * Parses a JSON transcript payload and stores courses into an evaluation store.
 */

export interface TranscriptCourse {
  courseId: string
  title: string
  credits: number
  grade: string
  gradePoints: number
}

export interface TranscriptPayload {
  courses: TranscriptCourse[]
}

export interface EvaluationStore {
  courses: TranscriptCourse[]
  gpa: number | null
}

const GRADE_POINT_MAP: Record<string, number> = {
  'A+': 4.0, A: 4.0, 'A-': 3.7,
  'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7,
  'D+': 1.3, D: 1.0, 'D-': 0.7,
  F: 0.0,
}

function computeGpa(courses: TranscriptCourse[]): number | null {
  if (courses.length === 0) return null
  let totalPoints = 0
  let totalCredits = 0
  for (const c of courses) {
    const gp = c.gradePoints ?? GRADE_POINT_MAP[c.grade]
    if (gp == null) continue
    totalPoints += gp * c.credits
    totalCredits += c.credits
  }
  return totalCredits === 0 ? null : totalPoints / totalCredits
}

/**
 * Parse and import a JSON transcript string into an evaluation store.
 * Throws on malformed JSON. Idempotent: re-importing the same transcript
 * replaces existing courses (keyed by courseId) without creating duplicates.
 */
export function importTranscript(json: string, existing: EvaluationStore): EvaluationStore {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Malformed transcript JSON: unable to parse')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as TranscriptPayload).courses)
  ) {
    throw new Error('Malformed transcript JSON: missing courses array')
  }

  const payload = parsed as TranscriptPayload
  const incoming = new Map<string, TranscriptCourse>()
  for (const c of payload.courses) {
    incoming.set(c.courseId, c)
  }

  // Replace matching, keep non-overlapping existing courses
  const merged: TranscriptCourse[] = []
  const seen = new Set<string>()
  for (const c of existing.courses) {
    if (incoming.has(c.courseId)) {
      merged.push(incoming.get(c.courseId)!)
    } else {
      merged.push(c)
    }
    seen.add(c.courseId)
  }
  for (const [id, c] of incoming) {
    if (!seen.has(id)) merged.push(c)
  }

  return { courses: merged, gpa: computeGpa(merged) }
}
