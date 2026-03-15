import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock Convex db + auth ctx builder ──────────────────────────────────────

type EvaluationRecord = {
  _id: string
  userId: string
  migrationSource: string
  email?: string
  uploadedAt?: number
  originalFilename?: string
  parsedData?: Record<string, unknown>
  storagePath?: string
  mimeType?: string
  fileSizeBytes?: number
}

type UserProfileRecord = {
  _id: string
  clerkUserId: string
  primaryEmail?: string
}

function buildMockCtx(options: {
  identity: { subject: string; email?: string } | null
  evaluations?: EvaluationRecord[]
  userProfiles?: UserProfileRecord[]
}) {
  const evaluations = options.evaluations ?? []
  const userProfiles = options.userProfiles ?? []
  const store: Record<string, any> = {}

  // Index all records by _id for db.get()
  for (const e of evaluations) store[e._id] = e
  for (const u of userProfiles) store[u._id] = u

  const queryChain = (table: string) => {
    const items =
      table === 'programEvaluations'
        ? evaluations
        : table === 'userProfiles'
          ? userProfiles
          : []
    return {
      withIndex: (_indexName: string, filterFn?: (q: any) => any) => {
        let filtered = [...items]
        if (filterFn) {
          const constraints: Record<string, unknown> = {}
          const q = new Proxy(
            {},
            {
              get: (_target, prop) => {
                return (field: string, value?: unknown) => {
                  if (prop === 'eq') constraints[field] = value
                  return q
                }
              },
            },
          )
          filterFn(q)
          filtered = filtered.filter((item: any) => {
            for (const [key, val] of Object.entries(constraints)) {
              if (item[key] !== val) return false
            }
            return true
          })
        }
        return {
          collect: async () => filtered,
          first: async () => filtered[0] ?? null,
        }
      },
    }
  }

  let insertCounter = 0

  return {
    auth: {
      getUserIdentity: async () => options.identity,
    },
    db: {
      query: (table: string) => queryChain(table),
      get: async (id: string) => store[id] ?? null,
      insert: vi.fn().mockImplementation(async (table: string, doc: any) => {
        const id = `inserted-${++insertCounter}`
        const record = { _id: id, ...doc }
        store[id] = record
        if (table === 'programEvaluations') evaluations.push(record)
        if (table === 'userProfiles') userProfiles.push(record)
        return id
      }),
      patch: vi.fn().mockImplementation(async (id: string, fields: any) => {
        if (store[id]) {
          Object.assign(store[id], fields)
        }
      }),
      delete: vi.fn(),
    },
  }
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('convex/evaluations write-then-read pipeline', () => {
  const CLERK_SUBJECT = 'clerk|eval-user-1'
  const USER_ID = 'user-profile-1'
  const NOW = 1700000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  function makeUserProfile(): UserProfileRecord {
    return { _id: USER_ID, clerkUserId: CLERK_SUBJECT, primaryEmail: 'test@example.com' }
  }

  async function getHandlers() {
    const mod = await import('../../../convex/evaluations')
    return {
      getCurrentProgramEvaluation: (mod.getCurrentProgramEvaluation as any)._handler,
      replaceCurrentProgramEvaluation: (mod.replaceCurrentProgramEvaluationFromUpload as any)
        ._handler,
    }
  }

  it('write evaluation → read returns matching data', async () => {
    const { replaceCurrentProgramEvaluation, getCurrentProgramEvaluation } = await getHandlers()

    const ctx = buildMockCtx({
      identity: { subject: CLERK_SUBJECT, email: 'test@example.com' },
      evaluations: [],
      userProfiles: [makeUserProfile()],
    })

    const payload = {
      email: 'test@example.com',
      uploaded_at: new Date(NOW).toISOString(),
      original_filename: 'transcript.pdf',
      parsed_data: {
        courses: [
          { code: 'CS101', credits: 3, grade: 'A' },
          { code: 'MATH201', credits: 4, grade: 'B+' },
        ],
        totalCredits: 7,
      },
      mime_type: 'application/pdf',
      file_size_bytes: 12345,
    }

    await replaceCurrentProgramEvaluation(ctx, { payload })

    // Read back — same ctx has the inserted record in its store
    const result = await getCurrentProgramEvaluation(ctx, {})

    expect(result).not.toBeNull()
    expect(result!.email).toBe('test@example.com')
    expect(result!.original_filename).toBe('transcript.pdf')
    expect(result!.parsed_data).toEqual(payload.parsed_data)
    expect(result!.mime_type).toBe('application/pdf')
    expect(result!.file_size_bytes).toBe(12345)
  })

  it('replace with updated data → read returns ONLY latest, no stale data', async () => {
    const { replaceCurrentProgramEvaluation, getCurrentProgramEvaluation } = await getHandlers()

    const ctx = buildMockCtx({
      identity: { subject: CLERK_SUBJECT, email: 'test@example.com' },
      evaluations: [],
      userProfiles: [makeUserProfile()],
    })

    // First write
    const payload1 = {
      email: 'test@example.com',
      original_filename: 'transcript_v1.pdf',
      parsed_data: {
        courses: [{ code: 'CS101', credits: 3, grade: 'A' }],
        totalCredits: 3,
      },
      file_size_bytes: 10000,
    }

    await replaceCurrentProgramEvaluation(ctx, { payload: payload1 })

    // Second write — updated data
    vi.setSystemTime(NOW + 60_000)
    const payload2 = {
      email: 'test@example.com',
      original_filename: 'transcript_v2.pdf',
      parsed_data: {
        courses: [
          { code: 'CS101', credits: 3, grade: 'A' },
          { code: 'ENG200', credits: 3, grade: 'A-' },
        ],
        totalCredits: 6,
      },
      file_size_bytes: 20000,
    }

    await replaceCurrentProgramEvaluation(ctx, { payload: payload2 })

    // Read back — should be v2 only
    const result = await getCurrentProgramEvaluation(ctx, {})

    expect(result).not.toBeNull()
    expect(result!.original_filename).toBe('transcript_v2.pdf')
    expect(result!.parsed_data.totalCredits).toBe(6)
    expect(result!.parsed_data.courses).toHaveLength(2)
    expect(result!.file_size_bytes).toBe(20000)
    // No stale v1 data
    expect(result!.original_filename).not.toBe('transcript_v1.pdf')
  })

  it('auth guard: unauthenticated getCurrentProgramEvaluation returns null', async () => {
    const { getCurrentProgramEvaluation } = await getHandlers()

    const ctx = buildMockCtx({
      identity: null,
      evaluations: [],
      userProfiles: [],
    })

    const result = await getCurrentProgramEvaluation(ctx, {})
    expect(result).toBeNull()
  })

  it('auth guard: unauthenticated replaceCurrentProgramEvaluation throws', async () => {
    const { replaceCurrentProgramEvaluation } = await getHandlers()

    const ctx = buildMockCtx({
      identity: null,
      evaluations: [],
      userProfiles: [],
    })

    await expect(
      replaceCurrentProgramEvaluation(ctx, {
        payload: { original_filename: 'test.pdf', file_size_bytes: 100 },
      }),
    ).rejects.toThrow()
  })

  it('empty state: user with no evaluation → getCurrentProgramEvaluation returns null', async () => {
    const { getCurrentProgramEvaluation } = await getHandlers()

    const ctx = buildMockCtx({
      identity: { subject: CLERK_SUBJECT },
      evaluations: [],
      userProfiles: [makeUserProfile()],
    })

    const result = await getCurrentProgramEvaluation(ctx, {})
    expect(result).toBeNull()
  })
})
