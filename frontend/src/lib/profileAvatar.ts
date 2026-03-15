// Pure profile avatar upload logic for testability.

export type ProfileRecord = {
  id: string
  userId: string
  displayName: string
  profilePhotoUrl: string | null
  profilePhotoStorageId: string | null
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

let nextId = 0

export function resetIdCounter() {
  nextId = 0
}

/**
 * Simulate generateUploadUrl — returns a presigned upload URL stub.
 */
export function generateUploadUrl(authenticated: boolean): string {
  if (!authenticated) {
    throw new Error('Authentication required')
  }
  return `https://upload.convex.cloud/${Date.now()}`
}

/**
 * Validate and process an avatar upload. Returns a storageId on success.
 */
export function uploadAvatar(
  mimeType: string,
  fileName: string,
  authenticated: boolean,
): { storageId: string } {
  if (!authenticated) {
    throw new Error('Authentication required')
  }
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Only image files are allowed.`)
  }
  return { storageId: `storage-${++nextId}` }
}

/**
 * Update a profile record with a new avatar storageId.
 */
export function updateProfileAvatar(
  profiles: ProfileRecord[],
  userId: string,
  storageId: string,
): ProfileRecord[] {
  return profiles.map((p) =>
    p.userId === userId
      ? { ...p, profilePhotoStorageId: storageId, profilePhotoUrl: `https://cdn.convex.cloud/${storageId}` }
      : p,
  )
}

/**
 * Get the avatar URL for a user profile.
 */
export function getAvatarUrl(profiles: ProfileRecord[], userId: string): string | null {
  const profile = profiles.find((p) => p.userId === userId)
  return profile?.profilePhotoUrl ?? null
}
