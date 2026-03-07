import type { UserPreferences } from '../../auth/AuthContext'
import { getApiBaseUrl } from '../runtimeConfig'
import type { SchedulingPreferencesFormValues } from './contracts'
import { resolveLegacyApiBaseUrl, toLegacyBoundaryError } from './legacyBoundary'

export function normalizeSchedulingPreferences(
  preferences: SchedulingPreferencesFormValues | null | undefined,
): SchedulingPreferencesFormValues {
  return {
    ...(preferences?.planning_mode ? { planning_mode: preferences.planning_mode } : {}),
    ...(preferences?.credit_load ? { credit_load: preferences.credit_load } : {}),
    ...(preferences?.schedule_preference ? { schedule_preference: preferences.schedule_preference } : {}),
    ...(preferences?.work_status ? { work_status: preferences.work_status } : {}),
    ...(preferences?.priority ? { priority: preferences.priority } : {}),
  }
}

export async function syncCurrentUserPreferencesFromLegacy(args: {
  jwt: string
  hydratePreferences: (args: { jwt: string; apiBaseUrl: string }) => Promise<UserPreferences>
  apiBaseUrl?: string
}) {
  try {
    return await args.hydratePreferences({
      jwt: args.jwt,
      apiBaseUrl: resolveLegacyApiBaseUrl(args.apiBaseUrl ?? getApiBaseUrl()),
    })
  } catch (error) {
    throw toLegacyBoundaryError(error) ?? error
  }
}

export async function syncCurrentSchedulingPreferencesFromLegacy(args: {
  jwt: string
  hydrateSchedulingPreferences: (args: { jwt: string; apiBaseUrl: string }) => Promise<SchedulingPreferencesFormValues>
  apiBaseUrl?: string
}) {
  try {
    return await args.hydrateSchedulingPreferences({
      jwt: args.jwt,
      apiBaseUrl: resolveLegacyApiBaseUrl(args.apiBaseUrl ?? getApiBaseUrl()),
    })
  } catch (error) {
    throw toLegacyBoundaryError(error) ?? error
  }
}