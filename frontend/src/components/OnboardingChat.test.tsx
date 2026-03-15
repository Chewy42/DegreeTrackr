// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import OnboardingChat from './OnboardingChat'

const mocks = vi.hoisted(() => ({
  completeOnboarding: vi.fn().mockResolvedValue({}),
  mergePreferences: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useMutation: () => mocks.completeOnboarding,
  useQuery: () => undefined,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    jwt: 'test-jwt',
    mergePreferences: mocks.mergePreferences,
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

const STORAGE_KEY = 'degreetrackr.onboarding_progress'

describe('OnboardingChat', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    sessionStorage.clear()
    vi.clearAllMocks()
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

  async function clickButton(text: string) {
    const btn = getButton(text)
    if (!btn) throw new Error(`Button with text "${text}" not found`)
    await act(async () => { btn.click() })
  }

  it('renders the first question on mount', async () => {
    await renderComponent()
    expect(container.textContent).toContain('What would you like to focus on today?')
  })

  it('does not show Back button on the first step', async () => {
    await renderComponent()
    expect(getButton('Go back')).toBeUndefined()
  })

  it('clicking an option advances to the next question', async () => {
    await renderComponent()
    await clickButton('Plan my next semester')
    expect(container.textContent).toContain('How many credits do you typically take per semester?')
  })

  it('clicking Back returns to the previous question', async () => {
    await renderComponent()
    await clickButton('Plan my next semester')
    expect(container.textContent).toContain('How many credits')

    await clickButton('Go back')
    expect(container.textContent).toContain('What would you like to focus on today?')
  })

  it('calls completeOnboarding with all collected answers on the final step', async () => {
    await renderComponent()
    await clickButton('Plan my next semester')   // planning_mode: upcoming_semester
    await clickButton('Light (9-12 credits)')    // credit_load: light
    await clickButton('Mornings')                // schedule_preference: mornings
    await clickButton('Part-time job')           // work_status: part_time
    await clickButton('Complete major requirements') // priority: major

    expect(mocks.completeOnboarding).toHaveBeenCalledWith({
      answers: {
        planning_mode: 'upcoming_semester',
        credit_load: 'light',
        schedule_preference: 'mornings',
        work_status: 'part_time',
        priority: 'major',
      },
    })
  })

  it('shows completion screen only after mutation resolves — Wave 1 regression', async () => {
    let resolveOnboarding!: () => void
    const deferred = new Promise<void>(res => { resolveOnboarding = res })
    mocks.completeOnboarding.mockReturnValueOnce(deferred)

    await renderComponent()

    await clickButton('Plan my next semester')
    await clickButton('Light (9-12 credits)')
    await clickButton('Mornings')
    await clickButton('Part-time job')

    // Trigger final answer without awaiting resolution
    act(() => { getButton('Complete major requirements')!.click() })

    // Completion screen must NOT appear before mutation resolves
    expect(container.textContent).not.toContain("You're All Set!")

    // Resolve the mutation
    await act(async () => { resolveOnboarding() })

    // Completion screen should now be visible
    expect(container.textContent).toContain("You're All Set!")
  })

  it('writes step and answers to sessionStorage on each step change', async () => {
    await renderComponent()

    // Initial effect writes index 0 to sessionStorage
    const initial = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)
    expect(initial.index).toBe(0)

    await clickButton('Plan my next semester')

    const afterStep1 = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)
    expect(afterStep1.index).toBe(1)
    expect(afterStep1.answers.planning_mode).toBe('upcoming_semester')
  })

  it('restores partial progress from sessionStorage on remount', async () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      index: 2,
      answers: { planning_mode: 'upcoming_semester', credit_load: 'light' },
    }))

    await renderComponent()

    // Index 2 = schedule_preference question
    expect(container.textContent).toContain('When do you prefer to take classes?')
  })

  // ── DT35 edge-case tests ────────────────────────────────────────────────────

  it('clears sessionStorage is cleared mid-session restarts from scratch on next mount', async () => {
    // User answers 2 questions (live component writes to sessionStorage on each step)
    await renderComponent()
    await clickButton('Plan my next semester')   // step 0 → 1
    await clickButton('Light (9-12 credits)')    // step 1 → 2

    // Simulate session being cleared (e.g. browser clears storage between visits)
    sessionStorage.clear()

    // Unmount and remount
    await act(async () => { root.unmount() })
    root = createRoot(container)
    await renderComponent()

    // With no saved state, should restart at question 0
    expect(container.textContent).toContain('What would you like to focus on today?')
  })

  it('mutation error shows error message and leaves option buttons interactive', async () => {
    mocks.completeOnboarding.mockRejectedValueOnce(new Error('Network failure'))

    await renderComponent()
    await clickButton('Plan my next semester')
    await clickButton('Light (9-12 credits)')
    await clickButton('Mornings')
    await clickButton('Part-time job')
    await clickButton('Complete major requirements')

    // Error message must be visible
    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert!.textContent).toContain('Something went wrong saving your preferences')

    // Option buttons must not be disabled — user can retry by clicking another answer
    const optionButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).filter(b =>
      ['Explore electives', 'Graduate on time'].some(t => b.textContent?.includes(t))
    )
    expect(optionButtons.length).toBeGreaterThan(0)
    optionButtons.forEach(btn => {
      expect(btn.disabled).toBe(false)
    })
  })

  it('calls mergePreferences with onboardingComplete:true after successful completion', async () => {
    await renderComponent()
    await clickButton('Plan my next semester')
    await clickButton('Standard (12-15 credits)')
    await clickButton('Mornings')
    await clickButton('Part-time job')
    await clickButton('Complete major requirements')

    expect(mocks.mergePreferences).toHaveBeenCalledWith({ onboardingComplete: true })
  })

  it('after 3 answers remounting shows the 4th question (network-disconnect scenario)', async () => {
    // Directly seed sessionStorage as if the user completed 3 questions then disconnected
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      index: 3,
      answers: {
        planning_mode: 'upcoming_semester',
        credit_load: 'standard',
        schedule_preference: 'mornings',
      },
    }))

    await renderComponent()

    // Index 3 = work_status question
    expect(container.textContent).toContain('Do you have any work commitments?')
  })
})
