// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRuntimeConfig } from '../lib/runtimeConfig'

describe('getRuntimeConfig', () => {
  beforeEach(() => {
    // Clear any window runtime config between tests
    delete (window as any).__DEGREETRACKR_RUNTIME_CONFIG__
    delete (window as any).__DEGREETRACKR_API_BASE_URL__
  })

  it('returns correct value for a known key via window config', () => {
    ;(window as any).__DEGREETRACKR_RUNTIME_CONFIG__ = {
      apiBaseUrl: 'https://api.example.com',
    }
    const config = getRuntimeConfig()
    expect(config.apiBaseUrl).toBe('https://api.example.com')
  })

  it('returns default /api when no apiBaseUrl is configured', () => {
    const config = getRuntimeConfig()
    expect(config.apiBaseUrl).toBe('/api')
  })

  it('includes all required keys in the returned config', () => {
    const config = getRuntimeConfig()
    expect(config).toHaveProperty('apiBaseUrl')
    expect(config).toHaveProperty('routerBasename')
    expect(config).toHaveProperty('sentryAdminRoutes')
    // optional keys are present (may be undefined)
    expect('convexUrl' in config).toBe(true)
    expect('clerkPublishableKey' in config).toBe(true)
  })

  it('reflects mocked env vars for convexUrl', () => {
    vi.stubEnv('VITE_CONVEX_URL', 'https://convex.test/')
    try {
      const config = getRuntimeConfig()
      // import.meta.env should pick up the stub
      expect(config.convexUrl).toBe('https://convex.test')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
