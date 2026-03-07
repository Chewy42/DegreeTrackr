import { ConvexReactClient } from 'convex/react'

import { getConvexProviderState, getConvexUrl } from './config'

let convexClient: ConvexReactClient | null | undefined

export function getConvexClient(): ConvexReactClient | null {
  if (convexClient !== undefined) {
    return convexClient
  }

  if (getConvexProviderState() !== 'ready') {
    convexClient = null
    return convexClient
  }

  const convexUrl = getConvexUrl()
  convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null
  return convexClient
}

export function resetConvexClientForTests(): void {
  convexClient = undefined
}