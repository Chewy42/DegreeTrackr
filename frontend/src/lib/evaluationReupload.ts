// Pure evaluation upload/replace logic extracted from convex/evaluations.ts for testability.

export type Evaluation = {
  id: string
  userId: string
  type: string
  storageId: string
}

let nextId = 0

export function resetIdCounter() {
  nextId = 0
}

export function uploadEvaluation(
  store: Evaluation[],
  userId: string,
  type: string,
  storageId: string,
): { store: Evaluation[]; evaluationId: string } {
  const evaluationId = `eval-${++nextId}`
  const existing = store.find((e) => e.userId === userId && e.type === type)
  if (existing) {
    const newStore = store.filter((e) => e !== existing)
    newStore.push({ id: evaluationId, userId, type, storageId })
    return { store: newStore, evaluationId }
  }
  return {
    store: [...store, { id: evaluationId, userId, type, storageId }],
    evaluationId,
  }
}

export function getEvaluation(store: Evaluation[], evaluationId: string): Evaluation {
  const found = store.find((e) => e.id === evaluationId)
  if (!found) throw new Error('Evaluation not found')
  return found
}
