/**
 * Notification preferences management.
 * Handles email notification toggle state and mutations.
 */

export interface NotificationPrefs {
  emailEnabled: boolean
}

const DEFAULT_PREFS: NotificationPrefs = { emailEnabled: false }

export function getDefaultNotificationPrefs(): NotificationPrefs {
  return { ...DEFAULT_PREFS }
}

/**
 * Simulate updating notification preferences via a mutation.
 * Throws if the user is not authenticated.
 */
export function updateNotificationPrefs(
  userId: string | null,
  prefs: Partial<NotificationPrefs>,
): NotificationPrefs {
  if (!userId) {
    throw new Error('Authentication required to update notification preferences')
  }
  return { ...DEFAULT_PREFS, ...prefs }
}
