// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { uploadEvaluation, getEvaluation, resetIdCounter, type Evaluation } from './evaluationReupload'

beforeEach(() => { resetIdCounter() })
afterEach(() => { resetIdCounter() })

describe('uploadEvaluation', () => {
  it('adds a new evaluation when store is empty', () => {
    const { store, evaluationId } = uploadEvaluation([], 'user-1', 'pdf', 'storage-abc')
    expect(store).toHaveLength(1)
    expect(store[0].userId).toBe('user-1')
    expect(store[0].type).toBe('pdf')
    expect(store[0].storageId).toBe('storage-abc')
    expect(typeof evaluationId).toBe('string')
  })

  it('replaces existing evaluation for same user and type', () => {
    const { store: s1 } = uploadEvaluation([], 'user-1', 'pdf', 'storage-old')
    const { store: s2, evaluationId: newId } = uploadEvaluation(s1, 'user-1', 'pdf', 'storage-new')
    expect(s2).toHaveLength(1)
    expect(s2[0].storageId).toBe('storage-new')
    expect(s2[0].id).toBe(newId)
  })

  it('keeps separate evaluations for different types', () => {
    const { store: s1 } = uploadEvaluation([], 'user-1', 'pdf', 'storage-1')
    const { store: s2 } = uploadEvaluation(s1, 'user-1', 'docx', 'storage-2')
    expect(s2).toHaveLength(2)
  })

  it('keeps separate evaluations for different users', () => {
    const { store: s1 } = uploadEvaluation([], 'user-1', 'pdf', 'storage-1')
    const { store: s2 } = uploadEvaluation(s1, 'user-2', 'pdf', 'storage-2')
    expect(s2).toHaveLength(2)
  })

  it('does not mutate original store', () => {
    const original: Evaluation[] = []
    uploadEvaluation(original, 'user-1', 'pdf', 'storage-1')
    expect(original).toHaveLength(0)
  })

  it('assigns incrementing unique ids', () => {
    const { evaluationId: id1 } = uploadEvaluation([], 'user-1', 'pdf', 's1')
    const { evaluationId: id2 } = uploadEvaluation([], 'user-2', 'pdf', 's2')
    expect(id1).not.toBe(id2)
  })
})

describe('getEvaluation', () => {
  it('returns the evaluation for a valid id', () => {
    const { store, evaluationId } = uploadEvaluation([], 'user-1', 'pdf', 'storage-abc')
    const result = getEvaluation(store, evaluationId)
    expect(result.id).toBe(evaluationId)
    expect(result.storageId).toBe('storage-abc')
  })

  it('throws for unknown evaluation id', () => {
    expect(() => getEvaluation([], 'nonexistent')).toThrow(/not found/i)
  })
})
