import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

const mockUseAuth = vi.fn()

vi.mock('@clerk/react', () => ({
  AuthenticateWithRedirectCallback: () => <div>Completing Clerk callback</div>,
}))

vi.mock('./auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

const baseContext = {
  sessionState: 'unauthenticated',
  mode: 'sign_in',
  auth: { email: '', password: '', confirmPassword: '' },
  loading: false,
  error: null,
  preferences: {},
  preferencesReady: true,
  jwt: null,
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
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
}

describe('App auth entry point', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows the Clerk Google sign-in entry point and removes the Supabase form', () => {
    mockUseAuth.mockReturnValue(baseContext)

    const html = renderApp()

    expect(html).toContain('Continue with Google')
    expect(html).toContain('Use your Chapman Google account to continue with Clerk.')
    expect(html).toContain('Email/password entry has been superseded')
    expect(html).not.toContain('Chapman Email')
    expect(html).not.toContain('Confirm Password')
  })

  it('shows Clerk-backed sign-up copy in sign-up mode', () => {
    mockUseAuth.mockReturnValue({ ...baseContext, mode: 'sign_up' })

    const html = renderApp()

    expect(html).toContain('Continue with Google')
    expect(html).toContain('create your Clerk-backed account and continue')
  })

  it('renders a setup notice when the legacy bridge is still required', () => {
    mockUseAuth.mockReturnValue({
      ...baseContext,
      sessionState: 'legacy_bridge_required',
    })

    const html = renderApp()

    expect(html).toContain('Legacy bridge setup required')
    expect(html).toContain('VITE_API_BASE_URL')
    expect(html).toContain('program evaluation')
  })

  it('renders the Clerk callback route', () => {
    mockUseAuth.mockReturnValue(baseContext)

    const html = renderApp('/sso-callback')

    expect(html).toContain('Completing Clerk callback')
    expect(html).toContain('Finishing your Google sign-in')
    expect(html).toContain('clerk-captcha')
  })

  it('waits for preferences before showing first-run authenticated surfaces', () => {
    mockUseAuth.mockReturnValue({
      ...baseContext,
      sessionState: 'authenticated',
      preferencesReady: false,
      preferences: {},
    })

    const html = renderApp('/')

    expect(html).toContain('Loading your DegreeTrackr setup...')
    expect(html).not.toContain('Upload your program evaluation')
  })

  it('does not render the old authenticated placeholder on unknown routes', () => {
    mockUseAuth.mockReturnValue({
      ...baseContext,
      sessionState: 'authenticated',
      preferencesReady: true,
      preferences: { hasProgramEvaluation: true, onboardingComplete: true, landingView: 'dashboard' },
    })

    const html = renderApp('/unknown-route')

    expect(html).not.toContain('This placeholder view confirms authentication flow is working.')
    expect(html).not.toContain('Welcome to DegreeTrackr')
  })
})
