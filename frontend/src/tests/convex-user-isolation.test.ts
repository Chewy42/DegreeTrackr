import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

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
  identity: { subject: string; email?: string; givenName?: string; familyName?: string; name?: string } | null
  db: ReturnType<typeof buildMockDb>
}) {
  return {
    auth: {
      getUserIdentity: async () => options.identity,
    },
    db: options.db,
  }
}

// ── Mock dependencies before importing ─────────────────────────────────────

vi.mock('../../../convex/contracts', () => ({
  onboardingAnswersValidator: {},
  schedulingPreferencesValidator: {},
  userPreferencesValidator: {},
}))

vi.mock('../../../convex/legacyHydration', () => ({
  legacyHydrationArgsValidator: {},
  readLegacyJson: vi.fn(),
}))

// ── Identities ─────────────────────────────────────────────────────────────

const userA = { subject: 'clerk|user_a', email: 'a@test.com', givenName: 'Alice', name: 'Alice A' }
const userB = { subject: 'clerk|user_b', email: 'b@test.com', givenName: 'Bob', name: 'Bob B' }

// ── Suite ──────────────────────────────────────────────────────────────────

describe('multi-user data isolation', () => {
  const NOW = 1700000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => { vi.useRealTimers() })

  // ── Profile isolation ──────────────────────────────────────────────────

  describe('profile isolation', () => {
    async function getProfileHandlers() {
      const mod = await import('../../../convex/profile')
      return {
        getCurrentUserProfile: (mod.getCurrentUserProfile as any)._handler,
        updateCurrentUserProfile: (mod.updateCurrentUserProfile as any)._handler,
      }
    }

    it('userA creates profile → userA can read it back', async () => {
      const { getCurrentUserProfile, updateCurrentUserProfile } = await getProfileHandlers()
      const db = buildMockDb()

      // userA creates profile via ensureCurrentUserRecord (triggered by update)
      const ctxA = buildMockCtx({ identity: userA, db })
      await updateCurrentUserProfile(ctxA, { patch: { firstName: 'Alice' } })

      const profileA = await getCurrentUserProfile(ctxA, {})
      expect(profileA).not.toBeNull()
      expect(profileA.clerkUserId).toBe(userA.subject)
      expect(profileA.firstName).toBe('Alice')
    })

    it('userB cannot see userA profile via getCurrentUserProfile (scoped to own identity)', async () => {
      const { getCurrentUserProfile, updateCurrentUserProfile } = await getProfileHandlers()
      const db = buildMockDb()

      // userA creates their profile
      const ctxA = buildMockCtx({ identity: userA, db })
      await updateCurrentUserProfile(ctxA, { patch: { firstName: 'Alice' } })

      // userB queries their own profile → null (no profile for userB yet)
      const ctxB = buildMockCtx({ identity: userB, db })
      const profileB = await getCurrentUserProfile(ctxB, {})
      expect(profileB).toBeNull()
    })

    it('userB update only affects userB profile, not userA profile', async () => {
      const { getCurrentUserProfile, updateCurrentUserProfile } = await getProfileHandlers()
      const db = buildMockDb()

      // Both users create profiles
      const ctxA = buildMockCtx({ identity: userA, db })
      await updateCurrentUserProfile(ctxA, { patch: { firstName: 'Alice' } })

      const ctxB = buildMockCtx({ identity: userB, db })
      await updateCurrentUserProfile(ctxB, { patch: { firstName: 'Bob' } })

      // userB updates their name
      await updateCurrentUserProfile(ctxB, { patch: { firstName: 'Robert' } })

      // userA profile unchanged
      const profileA = await getCurrentUserProfile(ctxA, {})
      expect(profileA.firstName).toBe('Alice')

      // userB profile updated
      const profileB = await getCurrentUserProfile(ctxB, {})
      expect(profileB.firstName).toBe('Robert')
    })
  })

  // ── Draft schedule isolation ───────────────────────────────────────────

  describe('draft schedule isolation', () => {
    async function getDraftHandlers() {
      const mod = await import('../../../convex/draftSchedule')
      return {
        getDraftSchedule: (mod.getDraftSchedule as any)._handler,
        saveDraftSchedule: (mod.saveDraftSchedule as any)._handler,
      }
    }

    it('userA addCourse → userB getDraftSchedule returns null (not userA data)', async () => {
      const { getDraftSchedule, saveDraftSchedule } = await getDraftHandlers()
      const db = buildMockDb()

      // userA saves a draft schedule
      const ctxA = buildMockCtx({ identity: userA, db })
      await saveDraftSchedule(ctxA, { classIds: ['CS101', 'MATH200'] })

      // userB queries their draft → null (no draft for userB)
      const ctxB = buildMockCtx({ identity: userB, db })
      const draftB = await getDraftSchedule(ctxB, {})
      expect(draftB).toBeNull()
    })

    it('both users have independent drafts', async () => {
      const { getDraftSchedule, saveDraftSchedule } = await getDraftHandlers()
      const db = buildMockDb()

      const ctxA = buildMockCtx({ identity: userA, db })
      await saveDraftSchedule(ctxA, { classIds: ['CS101'] })

      const ctxB = buildMockCtx({ identity: userB, db })
      await saveDraftSchedule(ctxB, { classIds: ['BIO200', 'CHEM110'] })

      const draftA = await getDraftSchedule(ctxA, {})
      expect(draftA!.classIds).toEqual(['CS101'])

      const draftB = await getDraftSchedule(ctxB, {})
      expect(draftB!.classIds).toEqual(['BIO200', 'CHEM110'])
    })
  })

  // ── Evaluation isolation ───────────────────────────────────────────────

  describe('evaluation isolation', () => {
    async function getEvalHandlers() {
      const mod = await import('../../../convex/evaluations')
      return {
        getCurrentProgramEvaluation: (mod.getCurrentProgramEvaluation as any)._handler,
        replaceCurrentProgramEvaluationFromUpload: (mod.replaceCurrentProgramEvaluationFromUpload as any)._handler,
      }
    }

    it('userA replaceEvaluation → userB getCurrentEvaluation returns null', async () => {
      const { getCurrentProgramEvaluation, replaceCurrentProgramEvaluationFromUpload } = await getEvalHandlers()
      const db = buildMockDb()

      // userA needs a profile first (ensureCurrentUserRecord)
      await db.insert('userProfiles', { clerkUserId: userA.subject, primaryEmail: userA.email })

      const ctxA = buildMockCtx({ identity: userA, db })
      await replaceCurrentProgramEvaluationFromUpload(ctxA, {
        payload: {
          email: userA.email,
          original_filename: 'eval.pdf',
          file_size_bytes: 1024,
        },
      })

      // Verify userA can see their evaluation
      const evalA = await getCurrentProgramEvaluation(ctxA, {})
      expect(evalA).not.toBeNull()
      expect(evalA!.email).toBe(userA.email)

      // userB has no profile or evaluation → null
      const ctxB = buildMockCtx({ identity: userB, db })
      const evalB = await getCurrentProgramEvaluation(ctxB, {})
      expect(evalB).toBeNull()
    })
  })

  // ── Snapshot isolation ─────────────────────────────────────────────────

  describe('snapshot isolation', () => {
    async function getSnapshotHandlers() {
      const mod = await import('../../../convex/scheduleSnapshots')
      return {
        listCurrentScheduleSnapshots: (mod.listCurrentScheduleSnapshots as any)._handler,
        createCurrentScheduleSnapshot: (mod.createCurrentScheduleSnapshot as any)._handler,
      }
    }

    it('userA createSnapshot → userB listSnapshots returns empty list', async () => {
      const { listCurrentScheduleSnapshots, createCurrentScheduleSnapshot } = await getSnapshotHandlers()
      const db = buildMockDb()

      // userA creates a snapshot
      const ctxA = buildMockCtx({ identity: userA, db })
      await createCurrentScheduleSnapshot(ctxA, {
        name: 'Fall 2026',
        classIds: ['CS101', 'MATH200'],
        totalCredits: 7,
      })

      // userA can list their snapshot
      const snapshotsA = await listCurrentScheduleSnapshots(ctxA, {})
      expect(snapshotsA).toHaveLength(1)
      expect(snapshotsA[0].name).toBe('Fall 2026')

      // userB lists snapshots → empty
      const ctxB = buildMockCtx({ identity: userB, db })
      const snapshotsB = await listCurrentScheduleSnapshots(ctxB, {})
      expect(snapshotsB).toHaveLength(0)
    })

    it('both users have independent snapshots', async () => {
      const { listCurrentScheduleSnapshots, createCurrentScheduleSnapshot } = await getSnapshotHandlers()
      const db = buildMockDb()

      const ctxA = buildMockCtx({ identity: userA, db })
      await createCurrentScheduleSnapshot(ctxA, {
        name: 'Fall A',
        classIds: ['CS101'],
        totalCredits: 3,
      })

      const ctxB = buildMockCtx({ identity: userB, db })
      await createCurrentScheduleSnapshot(ctxB, {
        name: 'Fall B',
        classIds: ['BIO200', 'CHEM110'],
        totalCredits: 8,
      })

      const snapshotsA = await listCurrentScheduleSnapshots(ctxA, {})
      expect(snapshotsA).toHaveLength(1)
      expect(snapshotsA[0].name).toBe('Fall A')

      const snapshotsB = await listCurrentScheduleSnapshots(ctxB, {})
      expect(snapshotsB).toHaveLength(1)
      expect(snapshotsB[0].name).toBe('Fall B')
    })
  })
})
