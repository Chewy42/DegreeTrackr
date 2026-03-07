import { v } from 'convex/values'

export const legacyHydrationArgsValidator = {
  jwt: v.string(),
  apiBaseUrl: v.string(),
}

export async function readLegacyJson<T>(
  path: string,
  args: { jwt: string; apiBaseUrl: string },
): Promise<T | null> {
  const url = `${args.apiBaseUrl}${path}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${args.jwt}`,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    if (response.status === 404) return null
    const LEGACY_BOUNDARY_ERROR_PREFIX = 'LEGACY_BOUNDARY_ERROR'
    throw new Error(`${LEGACY_BOUNDARY_ERROR_PREFIX}:${response.status}:Legacy API request failed.`)
  }
  return response.json() as Promise<T>
}

export async function requestLegacyJson<T>(
  path: string,
  args: { jwt: string; apiBaseUrl: string },
  options: RequestInit = {},
): Promise<T | null> {
  const url = `${args.apiBaseUrl}${path}`
  const extraHeaders = (options.headers as Record<string, string>) ?? {}
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.jwt}`,
      ...extraHeaders,
    },
  })
  if (!response.ok) {
    if (response.status === 404) return null
    const LEGACY_BOUNDARY_ERROR_PREFIX = 'LEGACY_BOUNDARY_ERROR'
    throw new Error(`${LEGACY_BOUNDARY_ERROR_PREFIX}:${response.status}:Legacy API request failed.`)
  }
  return response.json() as Promise<T>
}
