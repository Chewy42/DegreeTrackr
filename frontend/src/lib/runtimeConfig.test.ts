import { afterEach, describe, expect, it } from 'vitest'
import { apiUrl, getApiBaseUrl, hasConfiguredLegacyApiBaseUrl } from './runtimeConfig'

const originalWindow = globalThis.window

function setWindow(value: Window | undefined) {
  if (value) {
    Object.defineProperty(globalThis, 'window', {
      value,
      writable: true,
      configurable: true,
    })
    return
  }

  Reflect.deleteProperty(globalThis, 'window')
}

afterEach(() => {
  setWindow(originalWindow)
})

describe('runtimeConfig', () => {
  it('defaults apiUrl to the local legacy /api path', () => {
    expect(getApiBaseUrl()).toBe('/api')
    expect(hasConfiguredLegacyApiBaseUrl()).toBe(false)
    expect(apiUrl('/api/health')).toBe('/api/health')
  })

  it('builds API URLs from the injected runtime config', () => {
    setWindow({
      __DEGREETRACKR_RUNTIME_CONFIG__: {
        apiBaseUrl: 'https://legacy.example.com/api/',
      },
    } as Window)

    expect(getApiBaseUrl()).toBe('https://legacy.example.com/api')
    expect(hasConfiguredLegacyApiBaseUrl()).toBe(true)
    expect(apiUrl('/api/auth/clerk/session')).toBe(
      'https://legacy.example.com/api/auth/clerk/session'
    )
    expect(apiUrl('health')).toBe('https://legacy.example.com/api/health')
  })
})
