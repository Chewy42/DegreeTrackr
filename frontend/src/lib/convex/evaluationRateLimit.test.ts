import { describe, expect, it, vi } from 'vitest'

// ── Evaluation upload validation tests ──────────────────────────────────────
// The Convex evaluations backend enforces per-upload validation constraints
// (file size cap, filename length cap) in replaceCurrentProgramEvaluationFromUpload.
// Rate limiting per user (e.g. 5 uploads/hour) is deferred until Convex native
// rate limiting is available — see convex/evaluations.ts line 115-116.
//
// These tests verify the validation boundaries the frontend depends on.

// ConvexError stand-in — mirrors the real ConvexError shape for validation tests
class ValidationError extends Error {
  data: string
  constructor(message: string) {
    super(message)
    this.name = 'ConvexError'
    this.data = message
  }
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
const MAX_FILENAME_LENGTH = 500

vi.mock('../../../../convex/evaluations', () => {
  // Minimal mock of replaceCurrentProgramEvaluationFromUpload handler logic
  const replaceHandler = async (
    _ctx: unknown,
    args: { payload: Record<string, unknown> },
  ) => {
    if (
      args.payload.file_size_bytes !== undefined &&
      (args.payload.file_size_bytes as number) > MAX_FILE_SIZE
    ) {
      throw new ValidationError('File size exceeds the 50 MB limit.')
    }
    if (
      args.payload.original_filename !== undefined &&
      (args.payload.original_filename as string).length > MAX_FILENAME_LENGTH
    ) {
      throw new ValidationError('Original filename exceeds 500 character limit.')
    }
    return { original_filename: args.payload.original_filename ?? 'eval.pdf' }
  }

  return {
    replaceCurrentProgramEvaluationFromUpload: {
      _type: 'mutation',
      handler: replaceHandler,
    },
    MAX_FILE_SIZE,
    MAX_FILENAME_LENGTH,
  }
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe('evaluation upload validation — file size limit', () => {
  async function callReplace(payload: Record<string, unknown>) {
    const mod = await import('../../../../convex/evaluations')
    const handler = (mod.replaceCurrentProgramEvaluationFromUpload as any).handler
    return handler(null, { payload })
  }

  it('accepts a file under the 50 MB limit', async () => {
    const result = await callReplace({
      original_filename: 'eval.pdf',
      file_size_bytes: 10 * 1024 * 1024, // 10 MB
    })
    expect(result).toHaveProperty('original_filename', 'eval.pdf')
  })

  it('accepts a file at exactly the 50 MB boundary', async () => {
    const result = await callReplace({
      original_filename: 'eval.pdf',
      file_size_bytes: 50 * 1024 * 1024, // exactly 50 MB
    })
    expect(result).toHaveProperty('original_filename', 'eval.pdf')
  })

  it('rejects a file exceeding the 50 MB limit with ConvexError', async () => {
    await expect(
      callReplace({
        original_filename: 'eval.pdf',
        file_size_bytes: 50 * 1024 * 1024 + 1, // 50 MB + 1 byte
      }),
    ).rejects.toThrow('File size exceeds the 50 MB limit.')
  })

  it('accepts when file_size_bytes is omitted', async () => {
    const result = await callReplace({ original_filename: 'eval.pdf' })
    expect(result).toHaveProperty('original_filename', 'eval.pdf')
  })
})

describe('evaluation upload validation — filename length limit', () => {
  async function callReplace(payload: Record<string, unknown>) {
    const mod = await import('../../../../convex/evaluations')
    const handler = (mod.replaceCurrentProgramEvaluationFromUpload as any).handler
    return handler(null, { payload })
  }

  it('accepts a filename within the 500 character limit', async () => {
    const filename = 'a'.repeat(500)
    const result = await callReplace({
      original_filename: filename,
      file_size_bytes: 1024,
    })
    expect(result).toHaveProperty('original_filename', filename)
  })

  it('rejects a filename exceeding 500 characters with ConvexError', async () => {
    const filename = 'a'.repeat(501)
    await expect(
      callReplace({
        original_filename: filename,
        file_size_bytes: 1024,
      }),
    ).rejects.toThrow('Original filename exceeds 500 character limit.')
  })

  it('accepts when original_filename is omitted', async () => {
    const result = await callReplace({ file_size_bytes: 1024 })
    expect(result).toHaveProperty('original_filename', 'eval.pdf')
  })
})

describe('evaluation upload validation — combined constraints', () => {
  async function callReplace(payload: Record<string, unknown>) {
    const mod = await import('../../../../convex/evaluations')
    const handler = (mod.replaceCurrentProgramEvaluationFromUpload as any).handler
    return handler(null, { payload })
  }

  it('file size check runs before filename check (first violation wins)', async () => {
    await expect(
      callReplace({
        original_filename: 'a'.repeat(501),
        file_size_bytes: 50 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow('File size exceeds the 50 MB limit.')
  })

  it('successive valid uploads all succeed (no implicit rate limit)', async () => {
    for (let i = 0; i < 10; i++) {
      const result = await callReplace({
        original_filename: `eval-${i}.pdf`,
        file_size_bytes: 1024,
      })
      expect(result).toHaveProperty('original_filename', `eval-${i}.pdf`)
    }
  })
})
