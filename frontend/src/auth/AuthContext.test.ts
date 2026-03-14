import { describe, expect, it, vi } from 'vitest'

import { resolveClerkRuntimeSession } from './AuthContext'

describe('resolveClerkRuntimeSession', () => {
  it('returns the Clerk session token for frontend runtime use', async () => {
    const getToken = vi.fn(async () => 'clerk-session-token')

    await expect(resolveClerkRuntimeSession(getToken)).resolves.toBe('clerk-session-token')
    expect(getToken).toHaveBeenCalledTimes(1)
  })

  it('fails clearly when Clerk does not provide a session token', async () => {
    const getToken = vi.fn(async () => null)

    await expect(resolveClerkRuntimeSession(getToken)).rejects.toThrow('Unable to access your Clerk session.')
  })

  it('propagates underlying Clerk errors upward so callers can handle them', async () => {
    const getToken = vi.fn(async () => { throw new Error('Clerk SDK unavailable') })

    await expect(resolveClerkRuntimeSession(getToken)).rejects.toThrow('Clerk SDK unavailable')
  })

  it('calls getToken exactly once per resolution attempt', async () => {
    const getToken = vi.fn(async () => 'tok')

    await resolveClerkRuntimeSession(getToken)

    expect(getToken).toHaveBeenCalledTimes(1)
  })
})
