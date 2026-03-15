// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  getDefaultNotificationPrefs,
  updateNotificationPrefs,
} from './notificationPrefs'

describe('getDefaultNotificationPrefs', () => {
  it('returns emailEnabled=false by default', () => {
    expect(getDefaultNotificationPrefs().emailEnabled).toBe(false)
  })

  it('returns a new object on each call (not the same reference)', () => {
    const a = getDefaultNotificationPrefs()
    const b = getDefaultNotificationPrefs()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })
})

describe('updateNotificationPrefs', () => {
  it('throws when userId is null', () => {
    expect(() => updateNotificationPrefs(null, { emailEnabled: true })).toThrow(/auth/i)
  })

  it('throws when userId is empty string', () => {
    expect(() => updateNotificationPrefs('', { emailEnabled: true })).toThrow(/auth/i)
  })

  it('returns updated prefs when userId is provided', () => {
    const result = updateNotificationPrefs('user-1', { emailEnabled: true })
    expect(result.emailEnabled).toBe(true)
  })

  it('merges partial prefs with defaults', () => {
    const result = updateNotificationPrefs('user-1', {})
    expect(result.emailEnabled).toBe(false)
  })

  it('does not mutate the default prefs', () => {
    const before = getDefaultNotificationPrefs()
    updateNotificationPrefs('user-1', { emailEnabled: true })
    const after = getDefaultNotificationPrefs()
    expect(after.emailEnabled).toBe(false)
    expect(before.emailEnabled).toBe(false)
  })
})
