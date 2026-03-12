import { describe, expect, it, vi } from 'vitest'
import { shouldRequireLegacyBridgeSetup } from './AuthContext'

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
