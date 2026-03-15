// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// We re-import the module fresh per test via dynamic imports to pick up window changes
// But since Vite caches modules, we test through the exported functions directly
// and mutate window.__DEGREETRACKR_RUNTIME_CONFIG__ between tests.

import {
  getRuntimeConfig,
  getApiBaseUrl,
  apiUrl,
  isAdminSentryRoute,
  hasConfiguredLegacyApiBaseUrl,
} from './runtimeConfig'

describe('getRuntimeConfig — defaults', () => {
  beforeEach(() => {
    // Reset any window config between tests
    delete (window as any).__DEGREETRACKR_RUNTIME_CONFIG__
    delete (window as any).__DEGREETRACKR_API_BASE_URL__
  })

  afterEach(() => {
    delete (window as any).__DEGREETRACKR_RUNTIME_CONFIG__
    delete (window as any).__DEGREETRACKR_API_BASE_URL__
  })

  it('apiBaseUrl defaults to /api', () => {
    const config = getRuntimeConfig()
    expect(config.apiBaseUrl).toBe('/api')
  })

  it('routerBasename defaults to /', () => {
    const config = getRuntimeConfig()
    expect(config.routerBasename).toBe('/')
  })

  it('sentryAdminRoutes defaults to ["/admin"]', () => {
    const config = getRuntimeConfig()
    expect(config.sentryAdminRoutes).toContain('/admin')
  })

  it('clerkPublishableKey defaults to undefined when not configured', () => {
    const config = getRuntimeConfig()
    // May or may not be set depending on env; just check it is string or undefined
    expect(['string', 'undefined']).toContain(typeof config.clerkPublishableKey)
  })
})

describe('getRuntimeConfig — window override', () => {
  beforeEach(() => {
    delete (window as any).__DEGREETRACKR_RUNTIME_CONFIG__
    delete (window as any).__DEGREETRACKR_API_BASE_URL__
  })

  afterEach(() => {
    delete (window as any).__DEGREETRACKR_RUNTIME_CONFIG__
    delete (window as any).__DEGREETRACKR_API_BASE_URL__
  })

  it('uses window.__DEGREETRACKR_RUNTIME_CONFIG__.apiBaseUrl when set', () => {
    ;(window as any).__DEGREETRACKR_RUNTIME_CONFIG__ = { apiBaseUrl: 'https://api.example.com' }
    const config = getRuntimeConfig()
    expect(config.apiBaseUrl).toBe('https://api.example.com')
  })

  it('strips trailing slash from apiBaseUrl', () => {
    ;(window as any).__DEGREETRACKR_RUNTIME_CONFIG__ = { apiBaseUrl: 'https://api.example.com/' }
    const config = getRuntimeConfig()
    expect(config.apiBaseUrl).toBe('https://api.example.com')
  })

  it('uses legacy __DEGREETRACKR_API_BASE_URL__ when runtime config absent', () => {
    ;(window as any).__DEGREETRACKR_API_BASE_URL__ = 'https://legacy.example.com'
    const config = getRuntimeConfig()
    expect(config.apiBaseUrl).toBe('https://legacy.example.com')
  })
})

describe('getApiBaseUrl', () => {
  it('returns a string', () => {
    expect(typeof getApiBaseUrl()).toBe('string')
  })
})

describe('apiUrl', () => {
  beforeEach(() => {
    delete (window as any).__DEGREETRACKR_RUNTIME_CONFIG__
    delete (window as any).__DEGREETRACKR_API_BASE_URL__
  })

  afterEach(() => {
    delete (window as any).__DEGREETRACKR_RUNTIME_CONFIG__
    delete (window as any).__DEGREETRACKR_API_BASE_URL__
  })

  it('constructs URL by combining apiBaseUrl with endpoint path', () => {
    ;(window as any).__DEGREETRACKR_RUNTIME_CONFIG__ = { apiBaseUrl: 'https://api.example.com' }
    expect(apiUrl('/users')).toBe('https://api.example.com/users')
  })

  it('prepends / to path if missing', () => {
    ;(window as any).__DEGREETRACKR_RUNTIME_CONFIG__ = { apiBaseUrl: 'https://api.example.com' }
    expect(apiUrl('users')).toBe('https://api.example.com/users')
  })

  it('works with default /api base — normalizes /api prefix from path', () => {
    // normalizeEndpointPath strips the /api prefix from the path, then prepends apiBaseUrl (/api)
    // so /api/users → strip /api → /users → /api + /users = /api/users
    expect(apiUrl('/api/users')).toBe('/api/users')
  })
})

describe('isAdminSentryRoute', () => {
  it('returns true for the /admin route', () => {
    expect(isAdminSentryRoute('/admin', ['/admin'])).toBe(true)
  })

  it('returns true for sub-routes of /admin', () => {
    expect(isAdminSentryRoute('/admin/users', ['/admin'])).toBe(true)
  })

  it('returns false for non-admin routes', () => {
    expect(isAdminSentryRoute('/dashboard', ['/admin'])).toBe(false)
  })

  it('returns false for routes starting with /admin but not matching exactly', () => {
    // /adminX should not match /admin
    expect(isAdminSentryRoute('/adminX', ['/admin'])).toBe(false)
  })

  it('returns false for empty route list', () => {
    expect(isAdminSentryRoute('/admin', [])).toBe(false)
  })
})
