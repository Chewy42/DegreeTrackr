import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth as useClerkAuth, useClerk } from '@clerk/react'
import { useQuery } from 'convex/react'
import { buildClerkRedirectUrls, extractClerkErrorMessage } from './clerkAuth'
import { convexApi } from '../lib/convex/api'
import { isConvexFeatureEnabled } from '../lib/convex/config'
import { apiUrl } from '../lib/runtimeConfig'

export type AuthMode = 'sign_in' | 'sign_up'

export type AuthState = {
  email: string
  password: string
  confirmPassword: string
}

export type SessionState = 'checking' | 'unauthenticated' | 'authenticated' | 'pending_confirmation' | 'backend_unavailable'

export type UserPreferences = {
  theme?: 'light' | 'dark'
  landingView?: 'dashboard' | 'schedule' | 'explore'
  hasProgramEvaluation?: boolean
  onboardingComplete?: boolean
}

export type AuthContextValue = {
  sessionState: SessionState
  mode: AuthMode
  auth: AuthState
  loading: boolean
  error: string | null
  preferences: UserPreferences
  jwt: string | null
  pendingEmail: string | null
  setMode: (mode: AuthMode) => void
  setField: (field: keyof AuthState, value: string) => void
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  handleGoogleAuth: () => Promise<void>
  refreshPreferences: () => Promise<void>
  resendConfirmation: () => Promise<void>
  signOut: () => void
  mergePreferences: (patch: Partial<UserPreferences>) => void
  retryBackendConnection: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const LOCAL_SESSION_KEY = 'degreetrackr.auth.jwt'
const LOCAL_PREF_KEY = 'degreetrackr.preferences'

type Props = {
  children: React.ReactNode
}

type SessionExchangeResponse = {
  token: string
  preferences?: UserPreferences
}

function isValidJwtFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false
  }
  const parts = token.split('.')
  if (parts.length !== 3) {
    return false
  }
  try {
    for (const part of parts) {
      if (!part || !/^[A-Za-z0-9_-]+$/.test(part)) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

function safeGetLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage.getItem(key)
  } catch (err) {
    console.error(`Failed to read from localStorage (${key}):`, err)
    return null
  }
}

function safeParseJson<T>(json: string | null, fallback: T): T {
  if (!json) {
    return fallback
  }
  try {
    return JSON.parse(json) as T
  } catch (err) {
    console.error('Failed to parse JSON from localStorage:', err)
    return fallback
  }
}

async function exchangeClerkSession(clerkToken: string): Promise<SessionExchangeResponse> {
  const response = await fetch(apiUrl('/api/auth/clerk/session'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${clerkToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stayLoggedIn: true }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Unable to sync your Clerk session.'
    throw new Error(message)
  }

  if (typeof data?.token !== 'string' || !isValidJwtFormat(data.token)) {
    throw new Error('Received an invalid application session token.')
  }

  return data as SessionExchangeResponse
}

async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const res = await fetch(apiUrl('/api/health'), {
      method: 'GET',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    return res.ok
  } catch (err) {
    console.error('Backend health check failed:', err)
    return false
  }
}

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && (
    (err.message.toLowerCase().includes('network') ||
     err.message.toLowerCase().includes('fetch') ||
     err.message.toLowerCase().includes('failed'))
  )
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function AuthProvider({ children }: Props) {
  const { isLoaded: clerkLoaded, isSignedIn, getToken } = useClerkAuth()
  const clerk = useClerk()
  const [sessionState, setSessionState] = useState<SessionState>('checking')
  const [mode, setMode] = useState<AuthMode>('sign_in')
  const [auth, setAuth] = useState<AuthState>({ email: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<UserPreferences>({})
  const [jwt, setJwt] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const convexUserPrefs = useQuery(
    convexApi.profile.getCurrentUserPreferences,
    isConvexFeatureEnabled() ? {} : 'skip'
  )

  const persistJwt = useCallback((token: string | null) => {
    setJwt(token)
    if (typeof window === 'undefined') {
      return
    }
    try {
      if (token) {
        window.localStorage.setItem(LOCAL_SESSION_KEY, token)
      } else {
        window.localStorage.removeItem(LOCAL_SESSION_KEY)
      }
    } catch (err) {
      console.error('Failed to persist JWT to localStorage:', err)
    }
  }, [])

  const persistPreferences = useCallback((next: UserPreferences) => {
    setPreferences(next)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LOCAL_PREF_KEY, JSON.stringify(next))
      } catch (err) {
        console.error('Failed to persist preferences to localStorage:', err)
      }
    }
  }, [])

  const clearLocalSession = useCallback(() => {
    persistJwt(null)
    setAuth({ email: '', password: '', confirmPassword: '' })
    setPreferences({})
    setPendingEmail(null)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(LOCAL_PREF_KEY)
      } catch (err) {
        console.error('Failed to remove preferences from localStorage:', err)
      }
    }
  }, [persistJwt])

  const finalizeAuthenticatedSession = useCallback(async () => {
    const clerkToken = await getToken()
    if (!clerkToken) {
      throw new Error('Unable to access your Clerk session.')
    }

    const data = await exchangeClerkSession(clerkToken)
    persistJwt(data.token)
    persistPreferences(data.preferences ?? {})
    setPendingEmail(null)
    setError(null)
    setSessionState('authenticated')
  }, [getToken, persistJwt, persistPreferences])

  const signOut = useCallback(() => {
    clearLocalSession()
    setSessionState('unauthenticated')
    void clerk.signOut()
  }, [clearLocalSession, clerk])

  const syncSessionState = useCallback(async () => {
    const isHealthy = await checkBackendHealth()
    if (!isHealthy) {
      setSessionState('backend_unavailable')
      return
    }

    if (!isSignedIn) {
      clearLocalSession()
      setError(null)
      setSessionState('unauthenticated')
      return
    }

    try {
      await finalizeAuthenticatedSession()
    } catch (err) {
      clearLocalSession()
      setError(extractClerkErrorMessage(err, 'Unable to finish your Clerk sign-in.'))
      setSessionState('unauthenticated')
    }
  }, [clearLocalSession, finalizeAuthenticatedSession, isSignedIn])

  const retryBackendConnection = useCallback(async () => {
    if (!clerkLoaded) {
      return
    }

    setSessionState('checking')
    await syncSessionState()
  }, [clerkLoaded, syncSessionState])

  useEffect(() => {
    if (!clerkLoaded) {
      return
    }

    const storedPrefs = safeGetLocalStorage(LOCAL_PREF_KEY)
    setPreferences(safeParseJson<UserPreferences>(storedPrefs, {}))
    setSessionState('checking')

    void syncSessionState()
  }, [clerkLoaded, syncSessionState])

  const setField = (field: keyof AuthState, value: string) => {
    setAuth((prev) => ({ ...prev, [field]: value }))
  }

  const mergePreferences = useCallback((patch: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch }
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(LOCAL_PREF_KEY, JSON.stringify(next))
        } catch (err) {
          console.error('Failed to merge preferences to localStorage:', err)
        }
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (convexUserPrefs != null) {
      persistPreferences(convexUserPrefs as UserPreferences)
    }
  }, [convexUserPrefs, persistPreferences])

  const refreshPreferences = useCallback(async () => {
    if (!jwt) return

    // If Convex already has preferences, skip the Flask fetch
    if (convexUserPrefs != null) return

    const attemptFetch = async (): Promise<Response> => {
      return await fetch(apiUrl('/api/auth/preferences'), {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/json'
        }
      })
    }

    try {
      let res: Response
      try {
        res = await attemptFetch()
      } catch (err) {
        if (isNetworkError(err)) {
          console.error('Network error while refreshing preferences, using cached:', err)
          return
        }
        throw err
      }

      if (res.ok) {
        const prefs = await res.json() as UserPreferences
        persistPreferences(prefs)
        return
      }

      if (res.status === 401 || res.status === 403) {
        console.warn(`Auth error (${res.status}) refreshing preferences`)
        if (isSignedIn) {
          try {
            await finalizeAuthenticatedSession()
            return
          } catch (exchangeErr) {
            console.error('Failed to refresh Clerk-backed session:', exchangeErr)
          }
        }
        signOut()
        return
      }

      if (res.status >= 500 && res.status < 600) {
        console.warn(`Server error (${res.status}) refreshing preferences, retrying in 2s...`)
        await delay(2000)
        
        try {
          const retryRes = await attemptFetch()
          if (retryRes.ok) {
            const prefs = await retryRes.json() as UserPreferences
            persistPreferences(prefs)
            return
          }
          console.error(`Retry also failed with status ${retryRes.status}, using cached preferences`)
        } catch (retryErr) {
          console.error('Retry failed with error, using cached preferences:', retryErr)
        }
        return
      }

      console.error(`Unexpected error (${res.status}) refreshing preferences, using cached`)
    } catch (err) {
      console.error('Failed to refresh preferences, using cached:', err)
    }
  }, [convexUserPrefs, finalizeAuthenticatedSession, isSignedIn, jwt, persistPreferences, signOut])

  useEffect(() => {
    if (jwt && sessionState === 'authenticated') {
      refreshPreferences()
    }
  }, [jwt, sessionState, refreshPreferences])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(
      mode === 'sign_in'
        ? 'Email/password sign-in has been replaced here. Use Continue with Google.'
        : 'Email/password sign-up has been replaced here. Use Continue with Google.'
    )
  }

  const handleGoogleAuth = useCallback(async () => {
    if (!clerkLoaded || !clerk.client || typeof window === 'undefined') {
      setError('Authentication is still loading. Please try again in a moment.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const redirectUrls = buildClerkRedirectUrls(window.location)

      if (mode === 'sign_in') {
        await clerk.client.signIn.authenticateWithRedirect({
          strategy: 'oauth_google',
          ...redirectUrls,
        })
      } else {
        await clerk.client.signUp.authenticateWithRedirect({
          strategy: 'oauth_google',
          ...redirectUrls,
        })
      }
    } catch (err) {
      setError(
        extractClerkErrorMessage(
          err,
          mode === 'sign_in'
            ? 'Unable to sign in with Google.'
            : 'Unable to sign up with Google.'
        )
      )
      setLoading(false)
    }
  }, [clerk, clerkLoaded, mode])

  const resendConfirmation = async () => {
    throw new Error('Email confirmation is no longer handled by this touched Clerk flow.')
  }

  const value: AuthContextValue = useMemo(
    () => ({
      sessionState,
      mode,
      auth,
      loading,
      error,
      preferences,
      jwt,
      pendingEmail,
      setMode,
      setField,
      handleSubmit,
      handleGoogleAuth,
      refreshPreferences,
      resendConfirmation,
      signOut,
      mergePreferences,
      retryBackendConnection,
    }),
    [sessionState, mode, auth, loading, error, preferences, jwt, pendingEmail, handleGoogleAuth, mergePreferences, signOut, refreshPreferences, retryBackendConnection]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
