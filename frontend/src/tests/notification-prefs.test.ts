import { describe, expect, it } from 'vitest'
import {
  getDefaultNotificationPrefs,
  updateNotificationPrefs,
} from '../lib/notificationPrefs'

describe('Notification preferences — DT160', () => {
  it('enable email notifications → mutation called with emailEnabled: true', () => {
    const result = updateNotificationPrefs('user-1', { emailEnabled: true })
    expect(result.emailEnabled).toBe(true)
  })

  it('disable email notifications → mutation called with emailEnabled: false', () => {
    const result = updateNotificationPrefs('user-1', { emailEnabled: false })
    expect(result.emailEnabled).toBe(false)
  })

  it('toggle twice → final state matches second toggle', () => {
    updateNotificationPrefs('user-1', { emailEnabled: true })
    const final = updateNotificationPrefs('user-1', { emailEnabled: false })
    expect(final.emailEnabled).toBe(false)
  })

  it('unauthenticated → mutation throws auth error', () => {
    expect(() => updateNotificationPrefs(null, { emailEnabled: true })).toThrow(
      'Authentication required',
    )
  })

  it('default state: emailEnabled = false for new user', () => {
    const defaults = getDefaultNotificationPrefs()
    expect(defaults.emailEnabled).toBe(false)
  })
})
