import { describe, expect, it, vi } from 'vitest'
import {
  resolveSessionBootstrapState,
  shouldRequireLegacyBridgeSetup,
} from './AuthContext'

describe('shouldRequireLegacyBridgeSetup', () => {
  it('does not gate signed-out users behind the legacy bridge setup screen', async () => {
    const checkBackendHealth = vi.fn().mockResolvedValue(false)

    await expect(
      shouldRequireLegacyBridgeSetup({
        isConvexEnabled: true,
        isSignedIn: false,
        hasExplicitLegacyApiBaseUrl: false,
        checkBackendHealth,
      })
    ).resolves.toBe(false)

    expect(checkBackendHealth).not.toHaveBeenCalled()
  })

  it('does not require the setup screen when an explicit legacy bridge URL is configured', async () => {
    const checkBackendHealth = vi.fn().mockResolvedValue(false)

    await expect(
      shouldRequireLegacyBridgeSetup({
        isConvexEnabled: true,
        isSignedIn: true,
        hasExplicitLegacyApiBaseUrl: true,
        checkBackendHealth,
      })
    ).resolves.toBe(false)

    expect(checkBackendHealth).not.toHaveBeenCalled()
  })

  it('allows the default same-origin /api bridge when it is reachable', async () => {
    const checkBackendHealth = vi.fn().mockResolvedValue(true)

    await expect(
      shouldRequireLegacyBridgeSetup({
        isConvexEnabled: true,
        isSignedIn: true,
        hasExplicitLegacyApiBaseUrl: false,
        checkBackendHealth,
      })
    ).resolves.toBe(false)

    expect(checkBackendHealth).toHaveBeenCalledTimes(1)
  })

  it('requires setup when the default same-origin /api bridge is unavailable', async () => {
    const checkBackendHealth = vi.fn().mockResolvedValue(false)

    await expect(
      shouldRequireLegacyBridgeSetup({
        isConvexEnabled: true,
        isSignedIn: true,
        hasExplicitLegacyApiBaseUrl: false,
        checkBackendHealth,
      })
    ).resolves.toBe(true)

    expect(checkBackendHealth).toHaveBeenCalledTimes(1)
  })
})

describe('resolveSessionBootstrapState', () => {
  it('returns unauthenticated without probing the backend for signed-out users', async () => {
    const checkBackendHealth = vi.fn().mockResolvedValue(false)

    await expect(
      resolveSessionBootstrapState({
        isConvexEnabled: true,
        isSignedIn: false,
        hasExplicitLegacyApiBaseUrl: false,
        checkBackendHealth,
      })
    ).resolves.toBe('unauthenticated')

    expect(checkBackendHealth).not.toHaveBeenCalled()
  })

  it('returns legacy bridge required when a signed-in frontend-only session has no reachable default bridge', async () => {
    const checkBackendHealth = vi.fn().mockResolvedValue(false)

    await expect(
      resolveSessionBootstrapState({
        isConvexEnabled: true,
        isSignedIn: true,
        hasExplicitLegacyApiBaseUrl: false,
        checkBackendHealth,
      })
    ).resolves.toBe('legacy_bridge_required')

    expect(checkBackendHealth).toHaveBeenCalledTimes(1)
  })

  it('returns ready when a signed-in frontend-only session can reach the same-origin bridge', async () => {
    const checkBackendHealth = vi.fn().mockResolvedValue(true)

    await expect(
      resolveSessionBootstrapState({
        isConvexEnabled: true,
        isSignedIn: true,
        hasExplicitLegacyApiBaseUrl: false,
        checkBackendHealth,
      })
    ).resolves.toBe('ready')

    expect(checkBackendHealth).toHaveBeenCalledTimes(1)
  })

  it('returns backend unavailable when an explicit bridge is configured but unhealthy', async () => {
    const checkBackendHealth = vi.fn().mockResolvedValue(false)

    await expect(
      resolveSessionBootstrapState({
        isConvexEnabled: true,
        isSignedIn: true,
        hasExplicitLegacyApiBaseUrl: true,
        checkBackendHealth,
      })
    ).resolves.toBe('backend_unavailable')

    expect(checkBackendHealth).toHaveBeenCalledTimes(1)
  })
})
