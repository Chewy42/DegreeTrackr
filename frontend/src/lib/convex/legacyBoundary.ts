export class LegacyBoundaryError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'LegacyBoundaryError'
    this.status = status
  }
}

const LEGACY_BOUNDARY_ERROR_PREFIX = 'LEGACY_BOUNDARY_ERROR'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function resolveLegacyApiBaseUrl(apiBaseUrl: string, origin?: string): string {
  if (/^https?:\/\//.test(apiBaseUrl)) {
    return trimTrailingSlash(apiBaseUrl)
  }

  const resolvedOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
  if (!resolvedOrigin) {
    throw new Error('An absolute legacy API base URL is required outside the browser runtime.')
  }

  return trimTrailingSlash(new URL(apiBaseUrl, resolvedOrigin).toString())
}

export function toLegacyBoundaryError(error: unknown): LegacyBoundaryError | null {
  if (error instanceof LegacyBoundaryError) {
    return error
  }

  if (!(error instanceof Error)) {
    return null
  }

  const match = new RegExp(`^${LEGACY_BOUNDARY_ERROR_PREFIX}:(\\d+):(.*)$`).exec(error.message)
  if (!match) {
    return null
  }

  return new LegacyBoundaryError(match[2] || 'Legacy boundary request failed.', Number(match[1]))
}