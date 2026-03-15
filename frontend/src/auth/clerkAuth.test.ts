// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  CLERK_CALLBACK_PATH,
  buildReturnToPath,
  buildClerkRedirectUrls,
  extractClerkErrorMessage,
} from './clerkAuth'

describe('CLERK_CALLBACK_PATH', () => {
  it('is /sso-callback', () => {
    expect(CLERK_CALLBACK_PATH).toBe('/sso-callback')
  })
})

describe('buildReturnToPath', () => {
  it('returns the full path+search+hash for a normal location', () => {
    const loc = { pathname: '/dashboard', search: '', hash: '' }
    expect(buildReturnToPath(loc)).toBe('/dashboard')
  })

  it('includes search params in the return-to path', () => {
    const loc = { pathname: '/search', search: '?q=calc', hash: '' }
    expect(buildReturnToPath(loc)).toBe('/search?q=calc')
  })

  it('includes hash fragment in the return-to path', () => {
    const loc = { pathname: '/page', search: '', hash: '#section' }
    expect(buildReturnToPath(loc)).toBe('/page#section')
  })

  it('returns "/" when the path is the SSO callback path', () => {
    const loc = { pathname: CLERK_CALLBACK_PATH, search: '', hash: '' }
    expect(buildReturnToPath(loc)).toBe('/')
  })

  it('returns "/" when path starts with SSO callback path (e.g. with query)', () => {
    const loc = { pathname: CLERK_CALLBACK_PATH, search: '?code=abc', hash: '' }
    expect(buildReturnToPath(loc)).toBe('/')
  })
})

describe('buildClerkRedirectUrls', () => {
  it('builds redirectUrl using origin + CLERK_CALLBACK_PATH', () => {
    const loc = { origin: 'https://app.example.com', pathname: '/dashboard', search: '', hash: '' }
    const result = buildClerkRedirectUrls(loc)
    expect(result.redirectUrl).toBe(`https://app.example.com${CLERK_CALLBACK_PATH}`)
  })

  it('builds redirectUrlComplete from the current path', () => {
    const loc = { origin: 'https://app.example.com', pathname: '/study', search: '?set=123', hash: '' }
    const result = buildClerkRedirectUrls(loc)
    expect(result.redirectUrlComplete).toBe('/study?set=123')
  })

  it('redirectUrlComplete falls back to "/" when path is SSO callback', () => {
    const loc = { origin: 'https://app.example.com', pathname: CLERK_CALLBACK_PATH, search: '', hash: '' }
    const result = buildClerkRedirectUrls(loc)
    expect(result.redirectUrlComplete).toBe('/')
  })
})

describe('extractClerkErrorMessage', () => {
  it('extracts longMessage from the first Clerk error', () => {
    const error = { errors: [{ longMessage: 'Invalid credentials', message: 'short' }] }
    expect(extractClerkErrorMessage(error)).toBe('Invalid credentials')
  })

  it('falls back to message when longMessage is absent', () => {
    const error = { errors: [{ message: 'Email already taken' }] }
    expect(extractClerkErrorMessage(error)).toBe('Email already taken')
  })

  it('extracts from a native Error object', () => {
    const error = new Error('Network failure')
    expect(extractClerkErrorMessage(error)).toBe('Network failure')
  })

  it('extracts from top-level message property', () => {
    const error = { message: 'Top-level message' }
    expect(extractClerkErrorMessage(error)).toBe('Top-level message')
  })

  it('returns the fallback for null', () => {
    expect(extractClerkErrorMessage(null)).toBe('Unable to continue with Clerk.')
  })

  it('returns the fallback for undefined', () => {
    expect(extractClerkErrorMessage(undefined)).toBe('Unable to continue with Clerk.')
  })

  it('returns the fallback for an empty object', () => {
    expect(extractClerkErrorMessage({})).toBe('Unable to continue with Clerk.')
  })

  it('returns a custom fallback when provided', () => {
    expect(extractClerkErrorMessage(null, 'Custom fallback')).toBe('Custom fallback')
  })

  it('ignores whitespace-only longMessage and falls back to message', () => {
    const error = { errors: [{ longMessage: '   ', message: 'Real message' }] }
    expect(extractClerkErrorMessage(error)).toBe('Real message')
  })

  it('ignores whitespace-only message and falls back to default', () => {
    const error = { errors: [{ message: '  ' }] }
    expect(extractClerkErrorMessage(error)).toBe('Unable to continue with Clerk.')
  })
})
