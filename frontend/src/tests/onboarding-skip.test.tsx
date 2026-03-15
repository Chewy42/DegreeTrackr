// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import OnboardingChat from '../components/OnboardingChat'

const mocks = vi.hoisted(() => ({
  completeOnboarding: vi.fn().mockResolvedValue({}),
  mergePreferences: vi.fn(),
  preferences: { onboardingComplete: false } as Record<string, boolean>,
}))

vi.mock('convex/react', () => ({
  useMutation: () => mocks.completeOnboarding,
  useQuery: () => undefined,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    jwt: 'test-jwt',
    mergePreferences: mocks.mergePreferences,
    preferences: mocks.preferences,
  }),
}))

vi.mock('../lib/convex/api', () => ({
  convexApi: {
    profile: { completeCurrentOnboarding: 'profile:completeCurrentOnboarding' },
    evaluations: { clearCurrentProgramEvaluation: 'evaluations:clearCurrentProgramEvaluation' },
  },
}))

vi.mock('../lib/convex', () => ({
  getConvexClient: () => null,
  deleteCurrentProgramEvaluationBoundary: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) =>
    React.createElement('div', { 'data-testid': 'navigate-redirect', 'data-to': to }),
}))

const STORAGE_KEY = 'degreetrackr.onboarding_progress'

describe('OnboardingChat — skip path (DT146)', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    sessionStorage.clear()
    vi.clearAllMocks()
    mocks.preferences = { onboardingComplete: false }
    mocks.completeOnboarding.mockResolvedValue({})
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function renderComponent() {
    await act(async () => { root.render(<OnboardingChat />) })
  }

  function getButton(text: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      b.textContent?.includes(text)
    )
  }

  it('renders a "Skip for now" button on the onboarding screen', async () => {
    await renderComponent()
    const skipBtn = getButton('Skip for now')
    expect(skipBtn).not.toBeUndefined()
    expect(skipBtn!.disabled).toBe(false)
  })

  it('clicking Skip calls completeOnboarding with default answers', async () => {
    await renderComponent()
    const skipBtn = getButton('Skip for now')!
    await act(async () => { skipBtn.click() })

    expect(mocks.completeOnboarding).toHaveBeenCalledWith({
      answers: {
        planning_mode: 'upcoming_semester',
        credit_load: 'standard',
        schedule_preference: 'flexible',
        work_status: 'none',
        priority: 'major',
      },
    })
  })

  it('clicking Skip calls mergePreferences and shows completion screen', async () => {
    await renderComponent()
    const skipBtn = getButton('Skip for now')!
    await act(async () => { skipBtn.click() })

    expect(mocks.mergePreferences).toHaveBeenCalledWith({ onboardingComplete: true })
    expect(container.textContent).toContain("You're All Set!")
  })

  it('after skip, re-render with onboardingComplete=true navigates to /', async () => {
    await renderComponent()
    const skipBtn = getButton('Skip for now')!
    await act(async () => { skipBtn.click() })

    // Simulate what happens when preferences update triggers re-render
    mocks.preferences = { onboardingComplete: true }
    await act(async () => { root.unmount() })
    root = createRoot(container)
    await renderComponent()

    const redirect = container.querySelector('[data-testid="navigate-redirect"]')
    expect(redirect).not.toBeNull()
    expect(redirect!.getAttribute('data-to')).toBe('/')
    // Onboarding UI should not render
    expect(container.textContent).not.toContain('Quick Setup')
  })

  it('Skip button is disabled while mutation is in-flight', async () => {
    let resolveOnboarding!: () => void
    const deferred = new Promise<void>(res => { resolveOnboarding = res })
    mocks.completeOnboarding.mockReturnValueOnce(deferred)

    await renderComponent()
    const skipBtn = getButton('Skip for now')!
    act(() => { skipBtn.click() })

    // During in-flight, buttons should be disabled
    const skipDuring = getButton('Skip for now')
    expect(skipDuring?.disabled).toBe(true)

    await act(async () => { resolveOnboarding() })

    // After resolve, completion screen shows
    expect(container.textContent).toContain("You're All Set!")
  })
})
