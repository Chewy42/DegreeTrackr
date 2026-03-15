import { beforeEach, describe, expect, it } from 'vitest'
import {
  type Evaluation,
  getEvaluation,
  resetIdCounter,
  uploadEvaluation,
} from '../lib/evaluationReupload'

describe('Evaluation re-upload — DT151', () => {
  let store: Evaluation[]

  beforeEach(() => {
    store = []
    resetIdCounter()
  })

  it('upload evaluation with storageId A → returns evaluationId', () => {
    const result = uploadEvaluation(store, 'user-1', 'transcript', 'storage-A')
    expect(result.evaluationId).toBeTruthy()
    expect(result.store).toHaveLength(1)
    expect(result.store[0].storageId).toBe('storage-A')
  })

  it('re-upload with storageId B (same user, same type) → replaces A with B', () => {
    const first = uploadEvaluation(store, 'user-1', 'transcript', 'storage-A')
    const second = uploadEvaluation(first.store, 'user-1', 'transcript', 'storage-B')
    expect(second.store).toHaveLength(1)
    expect(second.store[0].storageId).toBe('storage-B')
    expect(second.evaluationId).not.toBe(first.evaluationId)
  })

  it('only one evaluation per type per user (no duplicates)', () => {
    const first = uploadEvaluation(store, 'user-1', 'transcript', 'storage-A')
    const second = uploadEvaluation(first.store, 'user-1', 'transcript', 'storage-B')
    const third = uploadEvaluation(second.store, 'user-1', 'transcript', 'storage-C')
    const userEvals = third.store.filter(
      (e) => e.userId === 'user-1' && e.type === 'transcript',
    )
    expect(userEvals).toHaveLength(1)
    expect(userEvals[0].storageId).toBe('storage-C')
  })

  it('previous evaluation deleted after re-upload (old id not found)', () => {
    const first = uploadEvaluation(store, 'user-1', 'transcript', 'storage-A')
    const second = uploadEvaluation(first.store, 'user-1', 'transcript', 'storage-B')
    expect(() => getEvaluation(second.store, first.evaluationId)).toThrow(
      'Evaluation not found',
    )
  })

  it('new evaluation accessible and old one throws "not found"', () => {
    const first = uploadEvaluation(store, 'user-1', 'transcript', 'storage-A')
    const second = uploadEvaluation(first.store, 'user-1', 'transcript', 'storage-B')
    // New one is accessible
    const current = getEvaluation(second.store, second.evaluationId)
    expect(current.storageId).toBe('storage-B')
    // Old one throws
    expect(() => getEvaluation(second.store, first.evaluationId)).toThrow('not found')
  })
})
