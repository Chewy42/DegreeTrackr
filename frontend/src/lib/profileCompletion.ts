/**
 * Profile completion percentage calculation.
 *
 * Determines how complete a user's academic profile is based on
 * whether key fields have been filled in.
 */

export interface ProfileFields {
  major?: string | null
  gpa?: number | null
  completedCourses?: string[] | null
}

const PROFILE_FIELDS: (keyof ProfileFields)[] = ['major', 'gpa', 'completedCourses']

/**
 * Calculate profile completion as an integer percentage (0–100).
 *
 * Each field contributes equally. A field counts as filled when it is
 * neither null nor undefined (and for arrays, has at least one entry).
 */
export function calculateProfileCompletion(profile: ProfileFields): number {
  let filled = 0

  for (const key of PROFILE_FIELDS) {
    const value = profile[key]
    if (value == null) continue
    if (Array.isArray(value) && value.length === 0) continue
    filled++
  }

  return Math.round((filled / PROFILE_FIELDS.length) * 100)
}
