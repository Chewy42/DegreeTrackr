import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth as useClerkAuth, useClerk } from '@clerk/react'
import { useQuery } from 'convex/react'
import { buildClerkRedirectUrls, extractClerkErrorMessage } from './clerkAuth'
import { convexApi } from '../lib/convex/api'
import { isConvexFeatureEnabled } from '../lib/convex/config'


export type AuthMode = 'sign_in' | 'sign_up'

export type AuthState = {
  email: string
  password: string
  confirmPassword: string
}

export type SessionState = 'checking' | 'unauthenticated' | 'authenticated' | 'pending_confirmation'

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
  /** True once preferences are confirmed loaded (from Convex or localStorage). Use to
   *  gate first-run surfaces so returning users don't flash the onboarding/upload screen. */
  preferencesReady: boolean
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

const LOCAL_PREF_KEY = 'degreetrackr.preferences'

type Props = {
  children: React.ReactNode
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

export async function resolveClerkRuntimeSession(
  getToken: () => Promise<string | null>,
): Promise<string> {
  const clerkToken = await getToken()
  if (!clerkToken) {
    throw new Error('Unable to access your Clerk session.')
  }

  return clerkToken
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
    const clerkToken = await resolveClerkRuntimeSession(getToken)
    persistJwt(clerkToken)
    setPendingEmail(null)
    setError(null)
    setSessionState('authenticated')
  }, [getToken, persistJwt])

  const signOut = useCallback(() => {
    clearLocalSession()
    setSessionState('unauthenticated')
    void clerk.signOut()
  }, [clearLocalSession, clerk])

  const syncSessionState = useCallback(async () => {
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
    if (convexUserPrefs != null) {
      persistPreferences(convexUserPrefs as UserPreferences)
      return
    }

    persistPreferences(safeParseJson<UserPreferences>(safeGetLocalStorage(LOCAL_PREF_KEY), {}))
  }, [convexUserPrefs, persistPreferences])

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

  // preferencesReady: true once Convex has responded (even with null/empty) or Convex is
  // disabled and we've fallen back to localStorage. Prevents returning users from seeing
  // a flash of the upload/onboarding screen while Convex is still fetching their prefs.
  const preferencesReady = !isConvexFeatureEnabled() || convexUserPrefs !== undefined

  const value: AuthContextValue = useMemo(
    () => ({
      sessionState,
      mode,
      auth,
      loading,
      error,
      preferences,
      preferencesReady,
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
    [sessionState, mode, auth, loading, error, preferences, preferencesReady, jwt, pendingEmail, handleGoogleAuth, mergePreferences, signOut, refreshPreferences, retryBackendConnection]
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
