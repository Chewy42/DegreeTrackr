import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock Convex db + auth ctx builder ──────────────────────────────────────

type MockRecord = Record<string, unknown> & { _id: string }

function buildMockDb(initialRecords: Map<string, MockRecord> = new Map()) {
  const records = new Map(initialRecords)
  let idCounter = 0

  const queryChain = (table: string) => {
    const tableRecords = [...records.values()].filter((r) => r._table === table)
    return {
      withIndex: (_indexName: string, filterFn?: (q: any) => any) => {
        let filtered = [...tableRecords]
        if (filterFn) {
          const constraints: Record<string, unknown> = {}
          const q = new Proxy(
            {},
            {
              get: (_target, _prop) => {
                return (field: string, value?: unknown) => {
                  if (_prop === 'eq') constraints[field] = value
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
      collect: async () => tableRecords,
      first: async () => tableRecords[0] ?? null,
    }
  }

  return {
    query: (table: string) => queryChain(table),
    get: async (id: string) => records.get(id) ?? null,
    insert: async (table: string, data: Record<string, unknown>) => {
      const newId = `${table}-${++idCounter}`
      const record: MockRecord = { ...data, _id: newId, _table: table, _creationTime: Date.now() }
      records.set(newId, record)
      return newId
    },
    patch: async (id: string, data: Record<string, unknown>) => {
      const existing = records.get(id)
      if (existing) {
        records.set(id, { ...existing, ...data })
      }
    },
    delete: async (id: string) => {
      records.delete(id)
    },
    _records: records,
  }
}

function buildMockCtx(options: {
  identity: { subject: string; email?: string; givenName?: string; name?: string } | null
  db: ReturnType<typeof buildMockDb>
}) {
  return {
    auth: { getUserIdentity: async () => options.identity },
    db: options.db,
  }
}

// ── Mock dependencies before importing ─────────────────────────────────────

vi.mock('../../../convex/contracts', () => ({
  chatScopeValidator: {},
  onboardingAnswersValidator: {},
  schedulingPreferencesValidator: {},
  userPreferencesValidator: {},
}))

vi.mock('../../../convex/legacyHydration', () => ({
  legacyHydrationArgsValidator: {},
  readLegacyJson: vi.fn(),
  requestLegacyJson: vi.fn(),
}))

// ── Identities ─────────────────────────────────────────────────────────────

const userA = { subject: 'clerk|user_a', email: 'a@test.com', givenName: 'Alice', name: 'Alice A' }
const userB = { subject: 'clerk|user_b', email: 'b@test.com', givenName: 'Bob', name: 'Bob B' }

// ── Handler helpers ────────────────────────────────────────────────────────

async function getDraftHandlers() {
  const mod = await import('../../../convex/draftSchedule')
  return {
    getDraftSchedule: (mod.getDraftSchedule as any)._handler,
    saveDraftSchedule: (mod.saveDraftSchedule as any)._handler,
  }
}

async function getSnapshotHandlers() {
  const mod = await import('../../../convex/scheduleSnapshots')
  return {
    create: (mod.createCurrentScheduleSnapshot as any)._handler,
    list: (mod.listCurrentScheduleSnapshots as any)._handler,
  }
}

async function getEvalHandlers() {
  const mod = await import('../../../convex/evaluations')
  return {
    getCurrentProgramEvaluation: (mod.getCurrentProgramEvaluation as any)._handler,
    replaceCurrentProgramEvaluationFromUpload: (mod.replaceCurrentProgramEvaluationFromUpload as any)._handler,
  }
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('concurrent two-user simulation', () => {
  const NOW = 1700000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  // ── Draft schedule isolation (simultaneous writes) ───────────────────

  describe('draft schedule — simultaneous adds', () => {
    it('userA adds CS101, userB adds MATH201 simultaneously → each sees only their own', async () => {
      const { getDraftSchedule, saveDraftSchedule } = await getDraftHandlers()
      const db = buildMockDb()
      const ctxA = buildMockCtx({ identity: userA, db })
      const ctxB = buildMockCtx({ identity: userB, db })

      // Simultaneous writes (await both concurrently)
      await Promise.all([
        saveDraftSchedule(ctxA, { classIds: ['CS101'] }),
        saveDraftSchedule(ctxB, { classIds: ['MATH201'] }),
      ])

      // getDraftSchedule(userA) returns only CS101
      const draftA = await getDraftSchedule(ctxA, {})
      expect(draftA).not.toBeNull()
      expect(draftA!.classIds).toEqual(['CS101'])

      // getDraftSchedule(userB) returns only MATH201
      const draftB = await getDraftSchedule(ctxB, {})
      expect(draftB).not.toBeNull()
      expect(draftB!.classIds).toEqual(['MATH201'])
    })

    it('userA updates schedule after simultaneous write → userB unaffected', async () => {
      const { getDraftSchedule, saveDraftSchedule } = await getDraftHandlers()
      const db = buildMockDb()
      const ctxA = buildMockCtx({ identity: userA, db })
      const ctxB = buildMockCtx({ identity: userB, db })

      // Initial simultaneous writes
      await Promise.all([
        saveDraftSchedule(ctxA, { classIds: ['CS101'] }),
        saveDraftSchedule(ctxB, { classIds: ['MATH201'] }),
      ])

      // userA updates their schedule
      await saveDraftSchedule(ctxA, { classIds: ['CS101', 'CS201'] })

      // userB still has only MATH201
      const draftB = await getDraftSchedule(ctxB, {})
      expect(draftB!.classIds).toEqual(['MATH201'])

      // userA has updated schedule
      const draftA = await getDraftSchedule(ctxA, {})
      expect(draftA!.classIds).toEqual(['CS101', 'CS201'])
    })
  })

  // ── Snapshot isolation (simultaneous creates) ────────────────────────

  describe('snapshots — simultaneous creates', () => {
    it('userA creates snapshot, userB creates different snapshot → lists are independent', async () => {
      const { create, list } = await getSnapshotHandlers()
      const db = buildMockDb()
      const ctxA = buildMockCtx({ identity: userA, db })
      const ctxB = buildMockCtx({ identity: userB, db })

      // Simultaneous snapshot creation
      await Promise.all([
        create(ctxA, { name: 'Fall Plan A', classIds: ['CS101', 'ENG100'], totalCredits: 6 }),
        create(ctxB, { name: 'Spring Plan B', classIds: ['MATH201', 'PHYS101'], totalCredits: 8 }),
      ])

      // listSnapshots(userA) does NOT include userB snapshot
      const snapshotsA = await list(ctxA, {})
      expect(snapshotsA).toHaveLength(1)
      expect(snapshotsA[0].name).toBe('Fall Plan A')
      expect(snapshotsA[0].classIds).toEqual(['CS101', 'ENG100'])

      // listSnapshots(userB) does NOT include userA snapshot
      const snapshotsB = await list(ctxB, {})
      expect(snapshotsB).toHaveLength(1)
      expect(snapshotsB[0].name).toBe('Spring Plan B')
      expect(snapshotsB[0].classIds).toEqual(['MATH201', 'PHYS101'])
    })

    it('multiple snapshots per user remain isolated', async () => {
      const { create, list } = await getSnapshotHandlers()
      const db = buildMockDb()
      const ctxA = buildMockCtx({ identity: userA, db })
      const ctxB = buildMockCtx({ identity: userB, db })

      // Both users create 2 snapshots each, interleaved
      await create(ctxA, { name: 'A-Fall', classIds: ['CS101'], totalCredits: 3 })
      vi.setSystemTime(NOW + 1000)
      await create(ctxB, { name: 'B-Fall', classIds: ['MATH201'], totalCredits: 4 })
      vi.setSystemTime(NOW + 2000)
      await create(ctxA, { name: 'A-Spring', classIds: ['CS201'], totalCredits: 3 })
      vi.setSystemTime(NOW + 3000)
      await create(ctxB, { name: 'B-Spring', classIds: ['MATH301'], totalCredits: 4 })

      const snapshotsA = await list(ctxA, {})
      expect(snapshotsA).toHaveLength(2)
      expect(snapshotsA.map((s: any) => s.name)).toEqual(['A-Spring', 'A-Fall'])

      const snapshotsB = await list(ctxB, {})
      expect(snapshotsB).toHaveLength(2)
      expect(snapshotsB.map((s: any) => s.name)).toEqual(['B-Spring', 'B-Fall'])
    })
  })

  // ── Evaluation isolation (simultaneous uploads) ──────────────────────

  describe('evaluations — simultaneous uploads', () => {
    it('userA evaluates program, userB evaluates different program → each sees only their own', async () => {
      const { getCurrentProgramEvaluation, replaceCurrentProgramEvaluationFromUpload } = await getEvalHandlers()
      const db = buildMockDb()

      // Seed user profiles (required by ensureCurrentUserRecord)
      await db.insert('userProfiles', { clerkUserId: userA.subject, primaryEmail: userA.email })
      await db.insert('userProfiles', { clerkUserId: userB.subject, primaryEmail: userB.email })

      const ctxA = buildMockCtx({ identity: userA, db })
      const ctxB = buildMockCtx({ identity: userB, db })

      // Simultaneous evaluation uploads
      await Promise.all([
        replaceCurrentProgramEvaluationFromUpload(ctxA, {
          payload: {
            email: userA.email,
            original_filename: 'cs_eval.pdf',
            file_size_bytes: 2048,
          },
        }),
        replaceCurrentProgramEvaluationFromUpload(ctxB, {
          payload: {
            email: userB.email,
            original_filename: 'math_eval.pdf',
            file_size_bytes: 4096,
          },
        }),
      ])

      // getCurrentProgramEvaluation(userA) is NOT userB's evaluation
      const evalA = await getCurrentProgramEvaluation(ctxA, {})
      expect(evalA).not.toBeNull()
      expect(evalA!.email).toBe(userA.email)
      expect(evalA!.original_filename).toBe('cs_eval.pdf')

      const evalB = await getCurrentProgramEvaluation(ctxB, {})
      expect(evalB).not.toBeNull()
      expect(evalB!.email).toBe(userB.email)
      expect(evalB!.original_filename).toBe('math_eval.pdf')
    })

    it('userA re-uploads evaluation → userB evaluation unchanged', async () => {
      const { getCurrentProgramEvaluation, replaceCurrentProgramEvaluationFromUpload } = await getEvalHandlers()
      const db = buildMockDb()

      await db.insert('userProfiles', { clerkUserId: userA.subject, primaryEmail: userA.email })
      await db.insert('userProfiles', { clerkUserId: userB.subject, primaryEmail: userB.email })

      const ctxA = buildMockCtx({ identity: userA, db })
      const ctxB = buildMockCtx({ identity: userB, db })

      // Initial uploads
      await Promise.all([
        replaceCurrentProgramEvaluationFromUpload(ctxA, {
          payload: { email: userA.email, original_filename: 'v1.pdf', file_size_bytes: 1024 },
        }),
        replaceCurrentProgramEvaluationFromUpload(ctxB, {
          payload: { email: userB.email, original_filename: 'bob_eval.pdf', file_size_bytes: 2048 },
        }),
      ])

      // userA re-uploads
      await replaceCurrentProgramEvaluationFromUpload(ctxA, {
        payload: { email: userA.email, original_filename: 'v2.pdf', file_size_bytes: 3072 },
      })

      // userA sees v2
      const evalA = await getCurrentProgramEvaluation(ctxA, {})
      expect(evalA!.original_filename).toBe('v2.pdf')

      // userB still sees their original
      const evalB = await getCurrentProgramEvaluation(ctxB, {})
      expect(evalB!.original_filename).toBe('bob_eval.pdf')
    })
  })

  // ── Cross-entity simultaneous operations ─────────────────────────────

  describe('cross-entity simultaneous operations', () => {
    it('userA saves schedule + snapshot while userB uploads eval — all isolated', async () => {
      const { saveDraftSchedule, getDraftSchedule } = await getDraftHandlers()
      const { create, list } = await getSnapshotHandlers()
      const { getCurrentProgramEvaluation, replaceCurrentProgramEvaluationFromUpload } = await getEvalHandlers()
      const db = buildMockDb()

      await db.insert('userProfiles', { clerkUserId: userB.subject, primaryEmail: userB.email })

      const ctxA = buildMockCtx({ identity: userA, db })
      const ctxB = buildMockCtx({ identity: userB, db })

      // All three operations happen simultaneously
      await Promise.all([
        saveDraftSchedule(ctxA, { classIds: ['CS101', 'CS201'] }),
        create(ctxA, { name: 'A Snapshot', classIds: ['CS101'], totalCredits: 3 }),
        replaceCurrentProgramEvaluationFromUpload(ctxB, {
          payload: { email: userB.email, original_filename: 'eval.pdf', file_size_bytes: 1024 },
        }),
      ])

      // userA: schedule and snapshot present
      const draftA = await getDraftSchedule(ctxA, {})
      expect(draftA!.classIds).toEqual(['CS101', 'CS201'])
      const snapshotsA = await list(ctxA, {})
      expect(snapshotsA).toHaveLength(1)

      // userB: no schedule, no snapshots, but has evaluation
      const draftB = await getDraftSchedule(ctxB, {})
      expect(draftB).toBeNull()
      const snapshotsB = await list(ctxB, {})
      expect(snapshotsB).toHaveLength(0)
      const evalB = await getCurrentProgramEvaluation(ctxB, {})
      expect(evalB).not.toBeNull()
      expect(evalB!.email).toBe(userB.email)
    })
  })
})
