import { apiUrl, getApiBaseUrl } from '../runtimeConfig'
import type {
  ProgramEvaluationMutationPayload,
  ProgramEvaluationPayload,
  ProgramEvaluationUploadResponse,
} from './contracts'
import { LegacyBoundaryError, resolveLegacyApiBaseUrl, toLegacyBoundaryError } from './legacyBoundary'

type FetchLike = typeof fetch

function buildAuthorizedHeaders(jwt: string): HeadersInit {
  return {
    Authorization: `Bearer ${jwt}`,
  }
}

export function buildLegacyProgramEvaluationPreviewUrl(jwt: string): string {
  return `${apiUrl('/api/program-evaluations')}?token=${encodeURIComponent(jwt)}`
}

export async function syncCurrentProgramEvaluationFromLegacy(args: {
  jwt: string
  hydrateProgramEvaluation: (args: { jwt: string; apiBaseUrl: string }) => Promise<ProgramEvaluationPayload | null>
  apiBaseUrl?: string
}): Promise<ProgramEvaluationPayload | null> {
  try {
    return await args.hydrateProgramEvaluation({
      jwt: args.jwt,
      apiBaseUrl: resolveLegacyApiBaseUrl(args.apiBaseUrl ?? getApiBaseUrl()),
    })
  } catch (error) {
    throw toLegacyBoundaryError(error) ?? error
  }
}

export async function replaceCurrentProgramEvaluationFromUpload(args: {
  jwt: string
  file: File
  replaceProgramEvaluation: (args: { payload: ProgramEvaluationMutationPayload }) => Promise<ProgramEvaluationPayload>
  fetchImpl?: FetchLike
}) {
  const fetchImpl = args.fetchImpl ?? fetch
  const formData = new FormData()
  formData.append('file', args.file)

  const response = await fetchImpl(apiUrl('/api/program-evaluations'), {
    method: 'POST',
    headers: buildAuthorizedHeaders(args.jwt),
    body: formData,
  })

  const body = await response.json().catch(() => ({ error: 'Unable to upload file.' } as ProgramEvaluationUploadResponse))
  if (!response.ok) {
    throw new LegacyBoundaryError(body.error ?? 'Unable to upload file.', response.status)
  }

  return args.replaceProgramEvaluation({
    payload: {
      original_filename: body.filename ?? args.file.name,
      parsed_data: body.parsed,
      mime_type: args.file.type || 'application/pdf',
      file_size_bytes: args.file.size,
    },
  })
}

export async function deleteCurrentProgramEvaluationBoundary(args: {
  jwt: string
  clearProgramEvaluation: () => Promise<unknown>
  fetchImpl?: FetchLike
}) {
  const fetchImpl = args.fetchImpl ?? fetch
  const response = await fetchImpl(apiUrl('/api/program-evaluations'), {
    method: 'DELETE',
    headers: buildAuthorizedHeaders(args.jwt),
  })

  if (!response.ok) {
    throw new LegacyBoundaryError('Unable to delete the current program evaluation.', response.status)
  }

  await args.clearProgramEvaluation()
}