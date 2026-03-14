// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import SettingsPage from './SettingsPage'

// Hoisted mocks — accessible in both vi.mock factories and test bodies
const mocks = vi.hoisted(() => ({
  updateSchedulingPrefs: vi.fn().mockResolvedValue({}),
  signOut: vi.fn(),
  toggleMode: vi.fn(),
  useQueryReturn: { value: undefined as Record<string, string> | null | undefined },
}))

vi.mock('convex/react', () => ({
  useMutation: () => mocks.updateSchedulingPrefs,
  useQuery: () => mocks.useQueryReturn.value,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ signOut: mocks.signOut }),
}))

vi.mock('../lib/convex/config', () => ({
  isConvexFeatureEnabled: vi.fn(() => true),
}))

vi.mock('../lib/convex/api', () => ({
  convexApi: {
    profile: {
      getCurrentSchedulingPreferences: 'profile:getCurrentSchedulingPreferences',
      updateCurrentSchedulingPreferences: 'profile:updateCurrentSchedulingPreferences',
    },
  },
}))

// Stub out complex child components
vi.mock('./ProgramEvaluationViewer', () => ({
  default: () => React.createElement('div', { 'data-testid': 'program-evaluation-viewer' }),
}))

vi.mock('../theme/AppThemeProvider', () => ({
  useAppTheme: () => ({ mode: 'light' as const, setMode: vi.fn(), toggleMode: mocks.toggleMode }),
  AppThemeProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

const LOADED_PREFS = {
  planning_mode: 'upcoming_semester',
  credit_load: 'standard',
  schedule_preference: 'mornings',
  work_status: 'none',
  priority: 'major',
}

describe('SettingsPage', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.updateSchedulingPrefs.mockResolvedValue({})
    mocks.useQueryReturn.value = undefined
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function renderComponent() {
    await act(async () => { root.render(<SettingsPage />) })
  }

  function getButton(text: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      b.textContent?.includes(text)
    )
  }

  it('initial loadState is "loading" not "idle" — Wave 1 regression', async () => {
    // Query still in-flight (undefined) — loadState must stay "loading", not flip to an idle/empty state
    mocks.useQueryReturn.value = undefined

    await renderComponent()

    const statusEl = container.querySelector('[role="status"]')
    expect(statusEl?.textContent).toContain('Loading preferences')
  })

  it('shows preference options once query data arrives', async () => {
    mocks.useQueryReturn.value = LOADED_PREFS

    await renderComponent()

    // Preference option buttons should be visible (aria-pressed attribute confirms them)
    const pressedBtns = container.querySelectorAll<HTMLButtonElement>('[aria-pressed]')
    expect(pressedBtns.length).toBeGreaterThan(0)
  })

  it('calls updateCurrentSchedulingPreferences with correct patch on save', async () => {
    mocks.useQueryReturn.value = LOADED_PREFS

    await renderComponent()

    // "Light (9-12)" is NOT currently selected (standard is selected for credit_load)
    const lightBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-pressed="false"]'))
      .find(b => b.textContent?.includes('Light (9-12)'))!

    await act(async () => { lightBtn.click() })

    expect(mocks.updateSchedulingPrefs).toHaveBeenCalledWith({
      patch: { credit_load: 'light' },
    })
  })

  it('shows success feedback after a preference is saved', async () => {
    mocks.useQueryReturn.value = LOADED_PREFS

    await renderComponent()

    const lightBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-pressed="false"]'))
      .find(b => b.textContent?.includes('Light (9-12)'))!

    await act(async () => { lightBtn.click() })

    // "Saved" status indicator must appear after mutation resolves
    const savedEl = Array.from(container.querySelectorAll('[role="status"]')).find(el =>
      el.textContent?.includes('Saved')
    )
    expect(savedEl).toBeDefined()
  })

  it('theme toggle button is rendered and triggers toggleMode on click', async () => {
    mocks.useQueryReturn.value = LOADED_PREFS

    await renderComponent()

    // ThemeModeToggle renders a button with aria-label "Switch to dark mode"
    const toggleBtn = container.querySelector<HTMLButtonElement>('[aria-label*="Switch to"]')
    expect(toggleBtn).toBeDefined()

    await act(async () => { toggleBtn!.click() })

    expect(mocks.toggleMode).toHaveBeenCalledTimes(1)
  })

  it('sign-out button calls signOut from auth context', async () => {
    mocks.useQueryReturn.value = LOADED_PREFS

    await renderComponent()

    const signOutBtn = getButton('Sign Out')
    expect(signOutBtn).toBeDefined()

    await act(async () => { signOutBtn!.click() })

    expect(mocks.signOut).toHaveBeenCalledTimes(1)
  })
})
