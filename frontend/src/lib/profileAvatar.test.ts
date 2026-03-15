// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  generateUploadUrl,
  uploadAvatar,
  updateProfileAvatar,
  getAvatarUrl,
  resetIdCounter,
  type ProfileRecord,
} from './profileAvatar'

const BASE_PROFILE: ProfileRecord = {
  id: 'p1',
  userId: 'user-1',
  displayName: 'Alice',
  profilePhotoUrl: null,
  profilePhotoStorageId: null,
}

beforeEach(() => { resetIdCounter() })
afterEach(() => { resetIdCounter() })

describe('generateUploadUrl', () => {
  it('returns a URL string when authenticated', () => {
    const url = generateUploadUrl(true)
    expect(typeof url).toBe('string')
    expect(url.startsWith('https://')).toBe(true)
  })

  it('throws when not authenticated', () => {
    expect(() => generateUploadUrl(false)).toThrow(/auth/i)
  })
})

describe('uploadAvatar', () => {
  it('returns a storageId for valid PNG', () => {
    const result = uploadAvatar('image/png', 'avatar.png', true)
    expect(typeof result.storageId).toBe('string')
    expect(result.storageId.length).toBeGreaterThan(0)
  })

  it('returns a storageId for JPEG', () => {
    const result = uploadAvatar('image/jpeg', 'photo.jpg', true)
    expect(result.storageId).toBeDefined()
  })

  it('returns a storageId for GIF', () => {
    expect(uploadAvatar('image/gif', 'anim.gif', true).storageId).toBeDefined()
  })

  it('returns a storageId for WebP', () => {
    expect(uploadAvatar('image/webp', 'img.webp', true).storageId).toBeDefined()
  })

  it('rejects non-image MIME type', () => {
    expect(() => uploadAvatar('application/pdf', 'doc.pdf', true)).toThrow(/invalid file type/i)
  })

  it('throws when not authenticated', () => {
    expect(() => uploadAvatar('image/png', 'avatar.png', false)).toThrow(/auth/i)
  })

  it('increments storageId on each call', () => {
    const a = uploadAvatar('image/png', 'a.png', true)
    const b = uploadAvatar('image/jpeg', 'b.jpg', true)
    expect(a.storageId).not.toBe(b.storageId)
  })
})

describe('updateProfileAvatar', () => {
  it('updates profilePhotoStorageId for the matching user', () => {
    const profiles = [BASE_PROFILE]
    const updated = updateProfileAvatar(profiles, 'user-1', 'storage-abc')
    expect(updated[0].profilePhotoStorageId).toBe('storage-abc')
  })

  it('sets profilePhotoUrl based on storageId', () => {
    const profiles = [BASE_PROFILE]
    const updated = updateProfileAvatar(profiles, 'user-1', 'storage-abc')
    expect(updated[0].profilePhotoUrl).toContain('storage-abc')
  })

  it('does not modify other users', () => {
    const other: ProfileRecord = { ...BASE_PROFILE, id: 'p2', userId: 'user-2' }
    const updated = updateProfileAvatar([BASE_PROFILE, other], 'user-1', 'storage-abc')
    expect(updated[1].profilePhotoStorageId).toBeNull()
  })

  it('does not mutate the original array', () => {
    const profiles = [{ ...BASE_PROFILE }]
    updateProfileAvatar(profiles, 'user-1', 'storage-abc')
    expect(profiles[0].profilePhotoStorageId).toBeNull()
  })
})

describe('getAvatarUrl', () => {
  it('returns null when no profile found', () => {
    expect(getAvatarUrl([], 'user-999')).toBeNull()
  })

  it('returns null when profile has no photo', () => {
    expect(getAvatarUrl([BASE_PROFILE], 'user-1')).toBeNull()
  })

  it('returns URL when profile has a photo', () => {
    const withPhoto: ProfileRecord = { ...BASE_PROFILE, profilePhotoUrl: 'https://cdn.example.com/photo.png' }
    expect(getAvatarUrl([withPhoto], 'user-1')).toBe('https://cdn.example.com/photo.png')
  })
})
