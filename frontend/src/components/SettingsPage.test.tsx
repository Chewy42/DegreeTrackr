// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import SettingsPage from './SettingsPage'

// ─── Mocks ───────────────────────────────────────────────────────

vi.mock('../hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }))

const mockSignOut = vi.fn()
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ signOut: mockSignOut, jwt: 'test-jwt', user: null }),
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => null),
  useMutation: vi.fn(() => vi.fn()),
}))

vi.mock('../lib/convex/api', () => ({
  convexApi: {
    profile: {
      getCurrentSchedulingPreferences: 'getCurrentSchedulingPreferences',
      updateCurrentSchedulingPreferences: 'updateCurrentSchedulingPreferences',
    },
  },
}))

vi.mock('../lib/convex/config', () => ({
  isConvexFeatureEnabled: vi.fn(() => true),
}))

vi.mock('./ThemeModeToggle', () => ({
  default: () => <div data-testid="theme-toggle" />,
}))

vi.mock('./AuthCard', () => ({
  default: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="auth-card">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

vi.mock('./ProgramEvaluationViewer', () => ({
  default: () => <div data-testid="program-eval" />,
}))

// ─── Tests ───────────────────────────────────────────────────────

describe('SettingsPage', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function render() {
    await act(async () => { root.render(<SettingsPage />) })
  }

  it('renders without throwing', async () => {
    await expect(render()).resolves.toBeUndefined()
  })

  it('renders "Settings" title', async () => {
    await render()
    expect(container.textContent).toContain('Settings')
  })

  it('renders the Appearance section', async () => {
    await render()
    expect(container.textContent).toContain('Appearance')
  })

  it('renders ThemeModeToggle', async () => {
    await render()
    expect(container.querySelector('[data-testid="theme-toggle"]')).not.toBeNull()
  })

  it('renders Scheduling Preferences section', async () => {
    await render()
    expect(container.textContent).toContain('Scheduling Preferences')
  })

  it('renders Refresh button', async () => {
    await render()
    const buttons = Array.from(container.querySelectorAll('button'))
    const refreshBtn = buttons.find(b => b.textContent?.includes('Refresh'))
    expect(refreshBtn).not.toBeUndefined()
  })

  it('renders Sign Out button', async () => {
    await render()
    const buttons = Array.from(container.querySelectorAll('button'))
    const signOutBtn = buttons.find(b => b.textContent?.toLowerCase().includes('sign out'))
    expect(signOutBtn).not.toBeUndefined()
  })

  it('calls signOut when Sign Out button is clicked', async () => {
    await render()
    const buttons = Array.from(container.querySelectorAll('button'))
    const signOutBtn = buttons.find(b => b.textContent?.toLowerCase().includes('sign out'))!
    await act(async () => { signOutBtn.click() })
    expect(mockSignOut).toHaveBeenCalledOnce()
  })

  it('renders ProgramEvaluationViewer', async () => {
    await render()
    expect(container.querySelector('[data-testid="program-eval"]')).not.toBeNull()
  })

  it('renders preference section cards (Planning Focus etc)', async () => {
    const { useQuery } = await import('convex/react')
    ;(useQuery as ReturnType<typeof vi.fn>).mockReturnValue({ planning_mode: 'upcoming_semester' })
    await render()
    expect(container.textContent).toContain('Planning Focus')
  })
})
