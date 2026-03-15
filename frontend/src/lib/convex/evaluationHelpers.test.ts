// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  buildLegacyProgramEvaluationPreviewUrl,
  loadCurrentProgramEvaluation,
} from './evaluationHelpers'

describe('buildLegacyProgramEvaluationPreviewUrl', () => {
  it('returns a URL string containing the JWT token', () => {
    const url = buildLegacyProgramEvaluationPreviewUrl('test-jwt-token')
    expect(typeof url).toBe('string')
    expect(url).toContain('test-jwt-token')
  })

  it('URL-encodes the JWT token', () => {
    const url = buildLegacyProgramEvaluationPreviewUrl('tok+en/with=specials')
    expect(url).toContain(encodeURIComponent('tok+en/with=specials'))
  })

  it('includes program-evaluations in the path', () => {
    const url = buildLegacyProgramEvaluationPreviewUrl('jwt')
    expect(url).toContain('program-evaluations')
  })
})

describe('loadCurrentProgramEvaluation', () => {
  it('returns null when getProgramEvaluation resolves null', async () => {
    const result = await loadCurrentProgramEvaluation({
      getProgramEvaluation: vi.fn().mockResolvedValue(null),
    })
    expect(result).toBeNull()
  })

  it('returns the evaluation when getProgramEvaluation resolves a payload', async () => {
    const payload = { parsed_data: { gpa: 3.5 }, original_filename: 'transcript.pdf' }
    const result = await loadCurrentProgramEvaluation({
      getProgramEvaluation: vi.fn().mockResolvedValue(payload),
    })
    expect(result).toEqual(payload)
  })
})
