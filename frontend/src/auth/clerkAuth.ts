export const CLERK_CALLBACK_PATH = '/sso-callback'

type BrowserLocationLike = Pick<Location, 'origin' | 'pathname' | 'search' | 'hash'>
type BrowserPathLike = Pick<Location, 'pathname' | 'search' | 'hash'>

type ClerkErrorLike = {
  errors?: Array<{ longMessage?: string; message?: string }>
  message?: string
}

export function buildReturnToPath(location: BrowserPathLike): string {
  const returnTo = `${location.pathname}${location.search}${location.hash}` || '/'
  return returnTo.startsWith(CLERK_CALLBACK_PATH) ? '/' : returnTo
}

export function buildClerkRedirectUrls(location: BrowserLocationLike) {
  return {
    redirectUrl: `${location.origin}${CLERK_CALLBACK_PATH}`,
    redirectUrlComplete: buildReturnToPath(location),
  }
}

export function extractClerkErrorMessage(
  error: unknown,
  fallback = 'Unable to continue with Clerk.'
): string {
  const typedError = error as ClerkErrorLike | undefined
  const firstError = typedError?.errors?.[0]

  if (typeof firstError?.longMessage === 'string' && firstError.longMessage.trim()) {
    return firstError.longMessage
  }

  if (typeof firstError?.message === 'string' && firstError.message.trim()) {
    return firstError.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof typedError?.message === 'string' && typedError.message.trim()) {
    return typedError.message
  }

  return fallback
}