import { beforeEach, describe, expect, it } from 'vitest'
import {
  type ProfileRecord,
  generateUploadUrl,
  getAvatarUrl,
  resetIdCounter,
  updateProfileAvatar,
  uploadAvatar,
} from '../lib/profileAvatar'

function makeProfile(userId: string): ProfileRecord {
  return {
    id: `profile-${userId}`,
    userId,
    displayName: `User ${userId}`,
    profilePhotoUrl: null,
    profilePhotoStorageId: null,
  }
}

describe('Profile avatar upload — DT166', () => {
  let profiles: ProfileRecord[]

  beforeEach(() => {
    profiles = [makeProfile('user-1')]
    resetIdCounter()
  })

  it('upload PNG → generateUploadUrl called → storageId returned', () => {
    const url = generateUploadUrl(true)
    expect(url).toContain('https://upload.convex.cloud/')
    const result = uploadAvatar('image/png', 'avatar.png', true)
    expect(result.storageId).toBeTruthy()
  })

  it('update profile with storageId → profilePhotoUrl updated', () => {
    const { storageId } = uploadAvatar('image/png', 'avatar.png', true)
    const updated = updateProfileAvatar(profiles, 'user-1', storageId)
    expect(updated[0].profilePhotoStorageId).toBe(storageId)
    expect(updated[0].profilePhotoUrl).toContain(storageId)
  })

  it('avatar URL rendered in profile (getAvatarUrl returns URL after update)', () => {
    const { storageId } = uploadAvatar('image/jpeg', 'photo.jpg', true)
    const updated = updateProfileAvatar(profiles, 'user-1', storageId)
    const url = getAvatarUrl(updated, 'user-1')
    expect(url).not.toBeNull()
    expect(url).toContain('https://cdn.convex.cloud/')
  })

  it('non-image file → validation error (rejects PDF)', () => {
    expect(() => uploadAvatar('application/pdf', 'doc.pdf', true)).toThrow(
      'Invalid file type',
    )
  })

  it('unauthenticated upload → throws auth error', () => {
    expect(() => uploadAvatar('image/png', 'avatar.png', false)).toThrow(
      'Authentication required',
    )
    expect(() => generateUploadUrl(false)).toThrow('Authentication required')
  })
})
