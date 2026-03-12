const DEFAULT_API_BASE_URL = '/api'
const DEFAULT_ROUTER_BASENAME = '/'
const DEFAULT_SENTRY_ADMIN_ROUTES = ['/admin'] as const
const VITE_HTML_PLACEHOLDER_PREFIX = '%VITE_'

export type RuntimeConfig = {
  apiBaseUrl: string
  routerBasename: string
  clerkPublishableKey?: string
  convexUrl?: string
  sentryDsn?: string
  sentryAdminRoutes: readonly string[]
}

type RuntimeConfigSource = {
  apiBaseUrl?: string
  routerBasename?: string
  clerkPublishableKey?: string
  convexUrl?: string
  sentryDsn?: string
  sentryAdminRoutes?: string | readonly string[]
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function isDefinedConfigValue(value: string | null | undefined): value is string {
  const normalizedValue = value?.trim()
  return Boolean(normalizedValue && !normalizedValue.startsWith(VITE_HTML_PLACEHOLDER_PREFIX))
}

function readConfiguredValue(value: string | null | undefined): string | undefined {
  return isDefinedConfigValue(value) ? value.trim() : undefined
}

function normalizeBasePath(value: string | undefined, fallback: string): string {
  const normalizedValue = readConfiguredValue(value)

  if (!normalizedValue || normalizedValue === '/') {
    return fallback
  }

  return `/${normalizedValue.replace(/^\/+|\/+$/g, '')}`
}

function normalizeUrl(value: string | undefined): string | undefined {
  const normalizedValue = readConfiguredValue(value)

  if (!normalizedValue) {
    return undefined
  }

  return normalizedValue === '/' ? normalizedValue : trimTrailingSlash(normalizedValue)
}

function normalizeRouteList(value: string | readonly string[] | undefined): readonly string[] {
  const rawRoutes = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value
          .split(',')
          .map((route: string) => route.trim())
          .filter(Boolean)
      : undefined

  if (!rawRoutes?.length) {
    return DEFAULT_SENTRY_ADMIN_ROUTES
  }

  const normalizedRoutes = rawRoutes.map((route: string) =>
    normalizeBasePath(route, DEFAULT_ROUTER_BASENAME)
  )
  return Array.from(new Set(normalizedRoutes))
}

function getWindowRuntimeConfig(): RuntimeConfigSource | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  if (window.__DEGREETRACKR_RUNTIME_CONFIG__) {
    return window.__DEGREETRACKR_RUNTIME_CONFIG__
  }

  if (isDefinedConfigValue(window.__DEGREETRACKR_API_BASE_URL__)) {
    return { apiBaseUrl: window.__DEGREETRACKR_API_BASE_URL__ }
  }

  return undefined
}

function getConfiguredApiBaseUrl(windowConfig: RuntimeConfigSource | undefined): string | undefined {
  return normalizeUrl(windowConfig?.apiBaseUrl) ?? normalizeUrl(import.meta.env.VITE_API_BASE_URL)
}

function normalizeEndpointPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (normalizedPath === DEFAULT_API_BASE_URL) {
    return ''
  }

  if (normalizedPath.startsWith(`${DEFAULT_API_BASE_URL}/`)) {
    return normalizedPath.slice(DEFAULT_API_BASE_URL.length)
  }

  return normalizedPath
}

export function getRuntimeConfig(): RuntimeConfig {
  const windowConfig = getWindowRuntimeConfig()

  return {
    apiBaseUrl: getConfiguredApiBaseUrl(windowConfig) ?? DEFAULT_API_BASE_URL,
    routerBasename: normalizeBasePath(
      windowConfig?.routerBasename ?? import.meta.env.VITE_ROUTER_BASENAME,
      DEFAULT_ROUTER_BASENAME
    ),
    clerkPublishableKey:
      readConfiguredValue(windowConfig?.clerkPublishableKey) ??
      readConfiguredValue(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY),
    convexUrl:
      normalizeUrl(windowConfig?.convexUrl) ??
      normalizeUrl(import.meta.env.VITE_CONVEX_URL),
    sentryDsn:
      readConfiguredValue(windowConfig?.sentryDsn) ??
      readConfiguredValue(import.meta.env.VITE_SENTRY_DSN),
    sentryAdminRoutes: normalizeRouteList(
      windowConfig?.sentryAdminRoutes ?? import.meta.env.VITE_SENTRY_ADMIN_ROUTES
    )
  }
}

export function getApiBaseUrl(): string {
  return getRuntimeConfig().apiBaseUrl
}

export function hasConfiguredLegacyApiBaseUrl(): boolean {
  return Boolean(getConfiguredApiBaseUrl(getWindowRuntimeConfig()))
}

export function apiUrl(path: string): string {
  return `${getApiBaseUrl()}${normalizeEndpointPath(path)}`
}

export function isAdminSentryRoute(
  pathname: string,
  configuredRoutes: readonly string[] = getRuntimeConfig().sentryAdminRoutes
): boolean {
  const normalizedPathname = normalizeBasePath(pathname, DEFAULT_ROUTER_BASENAME)

  return configuredRoutes.some((route) => {
    if (route === DEFAULT_ROUTER_BASENAME) {
      return normalizedPathname === DEFAULT_ROUTER_BASENAME
    }

    return normalizedPathname === route || normalizedPathname.startsWith(`${route}/`)
  })
}
