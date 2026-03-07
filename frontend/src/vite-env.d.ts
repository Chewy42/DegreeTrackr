/// <reference types="vite/client" />

interface DegreeTrackrRuntimeConfig {
  apiBaseUrl?: string
  routerBasename?: string
  clerkPublishableKey?: string
  convexUrl?: string
  sentryDsn?: string
  sentryAdminRoutes?: string | readonly string[]
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ROUTER_BASENAME?: string
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string
  readonly VITE_CONVEX_URL?: string
  readonly VITE_ENABLE_CONVEX?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ADMIN_ROUTES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  __DEGREETRACKR_RUNTIME_CONFIG__?: DegreeTrackrRuntimeConfig
  __DEGREETRACKR_API_BASE_URL__?: string
  Sentry?: {
    setTag?: (key: string, value: string) => void
    setContext?: (name: string, context: Record<string, unknown>) => void
  }
}
