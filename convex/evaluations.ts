import { actionGeneric, makeFunctionReference, mutationGeneric, queryGeneric } from 'convex/server'
import { v } from 'convex/values'

import { legacyHydrationArgsValidator, readLegacyJson } from './legacyHydration'
import { ensureCurrentUserRecord, getCurrentUserState } from './userState'

// ── Internal function references (for action → mutation calls) ─────────────

const syncCurrentProgramEvaluationFromLegacyRef = makeFunctionReference<
  'mutation',
  { payload: ProgramEvaluationMutationPayload },
  ProgramEvaluationPayload
>('evaluations:syncCurrentProgramEvaluationFromLegacy')

// ── Local type aliases (keep module self-contained) ────────────────────────

type ParsedProgramEvaluationData = Record<string, unknown>

type ProgramEvaluationPayload = {
  email?: string
  uploaded_at?: string
  original_filename?: string
  parsed_data?: ParsedProgramEvaluationData
  storage_path?: string
  mime_type?: string
  file_size_bytes?: number
}

type ProgramEvaluationMutationPayload = ProgramEvaluationPayload

// ── Arg validators ─────────────────────────────────────────────────────────

const programEvaluationPayloadValidator = v.object({
  email: v.optional(v.string()),
  uploaded_at: v.optional(v.string()),
  original_filename: v.optional(v.string()),
  parsed_data: v.optional(v.any()),
  storage_path: v.optional(v.string()),
  mime_type: v.optional(v.string()),
  file_size_bytes: v.optional(v.number()),
})

// ── Helpers ────────────────────────────────────────────────────────────────

async function getProgramEvaluationRecord(ctx: any, userId: any): Promise<any | null> {
  return ctx.db
    .query('programEvaluations')
    .withIndex('by_userId', (q: any) => q.eq('userId', userId))
    .first()
}

function toPayload(record: any): ProgramEvaluationPayload {
  return {
    ...(record.email !== undefined ? { email: record.email } : {}),
    ...(record.uploadedAt !== undefined ? { uploaded_at: new Date(record.uploadedAt).toISOString() } : {}),
    ...(record.originalFilename !== undefined ? { original_filename: record.originalFilename } : {}),
    ...(record.parsedData !== undefined ? { parsed_data: record.parsedData } : {}),
    ...(record.storagePath !== undefined ? { storage_path: record.storagePath } : {}),
    ...(record.mimeType !== undefined ? { mime_type: record.mimeType } : {}),
    ...(record.fileSizeBytes !== undefined ? { file_size_bytes: record.fileSizeBytes } : {}),
  }
}

function toDbFields(payload: ProgramEvaluationMutationPayload): Record<string, unknown> {
  return {
    ...(payload.email !== undefined ? { email: payload.email } : {}),
    uploadedAt: payload.uploaded_at ? new Date(payload.uploaded_at).getTime() : Date.now(),
    ...(payload.original_filename !== undefined ? { originalFilename: payload.original_filename } : {}),
    ...(payload.parsed_data !== undefined ? { parsedData: payload.parsed_data } : {}),
    ...(payload.storage_path !== undefined ? { storagePath: payload.storage_path } : {}),
    ...(payload.mime_type !== undefined ? { mimeType: payload.mime_type } : {}),
    ...(payload.file_size_bytes !== undefined ? { fileSizeBytes: payload.file_size_bytes } : {}),
  }
}

// ── Queries ────────────────────────────────────────────────────────────────

export const getCurrentProgramEvaluation = queryGeneric({
  args: {},
  handler: async (ctx): Promise<ProgramEvaluationPayload | null> => {
    const { user } = await getCurrentUserState(ctx)
    if (!user) return null
    const record = await getProgramEvaluationRecord(ctx, user._id)
    if (!record) return null
    return toPayload(record)
  },
})

// ── Mutations ──────────────────────────────────────────────────────────────

export const syncCurrentProgramEvaluationFromLegacy = mutationGeneric({
  args: { payload: programEvaluationPayloadValidator },
  handler: async (ctx, args): Promise<ProgramEvaluationPayload> => {
    const { user } = await ensureCurrentUserRecord(ctx)
    const fields = toDbFields(args.payload)
    const existing = await getProgramEvaluationRecord(ctx, user._id)
    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, migrationSource: 'legacy-flask' as const })
      const updated = await ctx.db.get(existing._id)
      return toPayload(updated)
    }
    const newId = await ctx.db.insert('programEvaluations', {
      userId: user._id,
      migrationSource: 'legacy-flask' as const,
      ...fields,
    })
    const record = await ctx.db.get(newId)
    return toPayload(record)
  },
})

export const replaceCurrentProgramEvaluationFromUpload = mutationGeneric({
  args: { payload: programEvaluationPayloadValidator },
  handler: async (ctx, args): Promise<ProgramEvaluationPayload> => {
    const { user } = await ensureCurrentUserRecord(ctx)
    const fields = toDbFields(args.payload)
    const existing = await getProgramEvaluationRecord(ctx, user._id)
    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, migrationSource: 'convex' as const })
      const updated = await ctx.db.get(existing._id)
      return toPayload(updated)
    }
    const newId = await ctx.db.insert('programEvaluations', {
      userId: user._id,
      migrationSource: 'convex' as const,
      ...fields,
    })
    const record = await ctx.db.get(newId)
    return toPayload(record)
  },
})

export const clearCurrentProgramEvaluation = mutationGeneric({
  args: {},
  handler: async (ctx): Promise<null> => {
    const { user } = await getCurrentUserState(ctx)
    if (!user) return null
    const existing = await getProgramEvaluationRecord(ctx, user._id)
    if (existing) {
      await ctx.db.delete(existing._id)
    }
    return null
  },
})

// ── Actions ────────────────────────────────────────────────────────────────

export const hydrateCurrentProgramEvaluationFromLegacy = actionGeneric({
  args: legacyHydrationArgsValidator,
  handler: async (ctx, args): Promise<ProgramEvaluationPayload | null> => {
    const data = await readLegacyJson<ProgramEvaluationPayload>('/program-evaluations/parsed', args)
    if (!data) return null
    return ctx.runMutation(syncCurrentProgramEvaluationFromLegacyRef, { payload: data })
  },
})
