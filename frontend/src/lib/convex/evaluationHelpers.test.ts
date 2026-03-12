import { describe, expect, it, vi } from 'vitest'

import type { ProgramEvaluationPayload } from './contracts'
import { loadCurrentProgramEvaluation } from './evaluationHelpers'

describe('loadCurrentProgramEvaluation', () => {
  it('returns the payload from Convex when it exists', async () => {
    const payload: ProgramEvaluationPayload = {
      email: 'user@example.edu',
      uploaded_at: '2026-03-12T00:00:00.000Z',
      original_filename: 'eval.pdf',
      parsed_data: { courses: { in_progress: [] } },
    }

    const result = await loadCurrentProgramEvaluation({
      getProgramEvaluation: vi.fn().mockResolvedValue(payload),
    })

    expect(result).toEqual(payload)
  })

  it('returns null when no evaluation exists', async () => {
    const result = await loadCurrentProgramEvaluation({
      getProgramEvaluation: vi.fn().mockResolvedValue(null),
    })

    expect(result).toBeNull()
  })
})
