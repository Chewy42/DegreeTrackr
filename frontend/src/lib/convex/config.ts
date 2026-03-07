type FrontendConvexEnv = {
  readonly VITE_CONVEX_URL?: string
  readonly VITE_ENABLE_CONVEX?: string
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string
}

type ConvexProviderState = 'disabled' | 'ready'

const ENABLED_FLAGS = new Set(['1', 'true', 'yes', 'on'])
const DISABLED_FLAGS = new Set(['0', 'false', 'no', 'off'])

function readEnv(): ImportMetaEnv & FrontendConvexEnv {
  return import.meta.env as ImportMetaEnv & FrontendConvexEnv
}

function normalizeOptionalEnvValue(value: string | undefined): string | null {
  const normalizedValue = value?.trim()
  return normalizedValue ? normalizedValue.replace(/\/+$/, '') : null
}

export function getConvexUrl(): string | null {
  return normalizeOptionalEnvValue(readEnv().VITE_CONVEX_URL)
}

export function getClerkPublishableKey(): string | null {
  return normalizeOptionalEnvValue(readEnv().VITE_CLERK_PUBLISHABLE_KEY)
}

export function isConvexFeatureEnabled(): boolean {
  const configuredUrl = getConvexUrl()
  if (!configuredUrl) {
    return false
  }

  const rawFlag = readEnv().VITE_ENABLE_CONVEX?.trim().toLowerCase()
  if (!rawFlag) {
    return true
  }
  if (DISABLED_FLAGS.has(rawFlag)) {
    return false
  }
  return ENABLED_FLAGS.has(rawFlag)
}

export function getConvexProviderState(): ConvexProviderState {
  return isConvexFeatureEnabled() ? 'ready' : 'disabled'
}