import type { ReactNode } from 'react'

import type { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'

export type ClerkConvexAuthHook = () => {
  isLoaded: boolean
  isSignedIn: boolean | undefined
  getToken: (options: { template?: 'convex'; skipCache?: boolean }) => Promise<string | null>
  orgId: string | null | undefined
  orgRole: string | null | undefined
}

type ConvexClerkProviderBoundaryProps = {
  children: ReactNode
  client: ConvexReactClient
  useAuth: ClerkConvexAuthHook
}

export function ConvexClerkProviderBoundary({ children, client, useAuth }: ConvexClerkProviderBoundaryProps) {
  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}