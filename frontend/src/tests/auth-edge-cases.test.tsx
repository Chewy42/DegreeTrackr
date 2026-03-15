import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AppThemeProvider } from '../theme/AppThemeProvider'

const mockUseAuth = vi.fn()

vi.mock('@clerk/react', () => ({
  AuthenticateWithRedirectCallback: () => <div>Completing Clerk callback</div>,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

const baseContext = {
  sessionState: 'unauthenticated' as const,
  mode: 'sign_in' as const,
  auth: { email: '', password: '', confirmPassword: '' },
  loading: false,
  error: null,
  preferences: { hasProgramEvaluation: true, onboardingComplete: true },
  preferencesReady: true,
  jwt: 'test-jwt',
  pendingEmail: null,
  setMode: vi.fn(),
  setField: vi.fn(),
  handleSubmit: vi.fn(),
  handleGoogleAuth: vi.fn(async () => undefined),
  refreshPreferences: vi.fn(async () => undefined),
  resendConfirmation: vi.fn(async () => undefined),
  signOut: vi.fn(),
  mergePreferences: vi.fn(),
  retryBackendConnection: vi.fn(async () => undefined),
}

function renderApp(path = '/') {
  return renderToStaticMarkup(
    <AppThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AppThemeProvider>
  )
}

describe('Auth edge cases', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('expired session (userId null / signed out)', () => {
    it('shows auth prompt instead of crashing on protected route /', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'unauthenticated',
        jwt: null,
      })

      const html = renderApp('/')

      expect(html).toContain('Continue with Google')
      expect(html).not.toContain('Page not found.')
    })

    it('shows auth prompt on /progress-page when session expired', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'unauthenticated',
        jwt: null,
      })

      const html = renderApp('/progress-page')

      expect(html).toContain('Continue with Google')
    })

    it('shows auth prompt on /exploration-assistant when session expired', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'unauthenticated',
        jwt: null,
      })

      const html = renderApp('/exploration-assistant')

      expect(html).toContain('Continue with Google')
    })

    it('shows auth prompt on /settings when session expired', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'unauthenticated',
        jwt: null,
      })

      const html = renderApp('/settings')

      expect(html).toContain('Continue with Google')
    })

    it('shows auth prompt on /schedule-gen-home when session expired', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'unauthenticated',
        jwt: null,
      })

      const html = renderApp('/schedule-gen-home')

      expect(html).toContain('Continue with Google')
    })
  })

  describe('session timeout mid-mutation (ConvexError Unauthenticated)', () => {
    it('shows error in auth context when mutation throws Unauthenticated', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'unauthenticated',
        jwt: null,
        error: 'Your session has expired. Please sign in again.',
      })

      const html = renderApp('/')

      expect(html).toContain('Your session has expired. Please sign in again.')
      expect(html).toContain('Continue with Google')
      // Error is shown in the alert region
      expect(html).toContain('role="alert"')
    })

    it('does not crash or show blank page on auth error', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'unauthenticated',
        jwt: null,
        error: 'Unauthenticated',
      })

      const html = renderApp('/')

      expect(html).toContain('Unauthenticated')
      expect(html).toContain('DegreeTrackr')
      // Page renders fully — no crash
      expect(html.length).toBeGreaterThan(100)
    })
  })

  describe('loading state (Clerk isLoaded: false → checking)', () => {
    it('shows loading spinner on /, not route content', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'checking',
      })

      const html = renderApp('/')

      expect(html).toContain('Preparing your DegreeTrackr workspace')
      expect(html).toContain('animate-pulse')
      // Must not show auth form or any protected content
      expect(html).not.toContain('Continue with Google')
      expect(html).not.toContain('Upload your program evaluation')
      expect(html).not.toContain('Page not found.')
    })

    it('shows loading spinner on /settings, not route content', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'checking',
      })

      const html = renderApp('/settings')

      expect(html).toContain('Preparing your DegreeTrackr workspace')
      expect(html).not.toContain('Continue with Google')
    })

    it('shows preferences-loading screen when authenticated but preferences not ready', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'authenticated',
        preferencesReady: false,
        preferences: {},
      })

      const html = renderApp('/')

      expect(html).toContain('Loading your DegreeTrackr setup')
      expect(html).toContain('animate-pulse')
      expect(html).not.toContain('Upload your program evaluation')
      expect(html).not.toContain('Page not found.')
    })
  })

  describe('signed-in user (normal auth state)', () => {
    it('renders dashboard content on / for fully onboarded user', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'authenticated',
        preferencesReady: true,
        preferences: { hasProgramEvaluation: true, onboardingComplete: true },
      })

      const html = renderApp('/')

      // Should not show auth or loading
      expect(html).not.toContain('Continue with Google')
      expect(html).not.toContain('Preparing your DegreeTrackr workspace')
      expect(html).not.toContain('Loading your DegreeTrackr setup')
      // Should not show onboarding gates
      expect(html).not.toContain('Upload your program evaluation')
    })

    it('shows upload gate for user without program evaluation', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'authenticated',
        preferencesReady: true,
        preferences: { hasProgramEvaluation: false, onboardingComplete: false },
      })

      const html = renderApp('/')

      expect(html).toContain('Upload your program evaluation')
    })

    it('shows Page not found for unknown route when authenticated', () => {
      mockUseAuth.mockReturnValue({
        ...baseContext,
        sessionState: 'authenticated',
        preferencesReady: true,
        preferences: { hasProgramEvaluation: true, onboardingComplete: true },
      })

      const html = renderApp('/nonexistent-page')

      expect(html).toContain('Page not found.')
    })
  })
})
