// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import OnboardingChat from './OnboardingChat'

// ── Hoisted mocks ──────────────────────────────────────────────────────────

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

// ── Expected full-flow answers ─────────────────────────────────────────────

// Each entry: [buttonTextSubstring, questionId, expectedValue]
const FULL_FLOW: [string, string, string][] = [
  ['Create a 4-year plan',       'planning_mode',        'four_year_plan'],
  ['Heavy (15-18 credits)',      'credit_load',          'heavy'],
  ['Flexible / No preference',  'schedule_preference',  'flexible'],
  ['Full-time job',              'work_status',          'full_time'],
  ['Graduate on time',           'priority',             'graduate'],
]

const EXPECTED_QUESTIONS = [
  'What would you like to focus on today?',
  'How many credits do you typically take per semester?',
  'When do you prefer to take classes?',
  'Do you have any work commitments?',
  "What's your main priority right now?",
]

// ── Test suite ─────────────────────────────────────────────────────────────

describe('OnboardingChat full-flow integration', () => {
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

  async function clickButton(text: string) {
    const btn = getButton(text)
    if (!btn) throw new Error(`Button with text "${text}" not found`)
    await act(async () => { btn.click() })
  }

  it('steps through all 5 questions and calls completeOnboarding with correct answers', async () => {
    await renderComponent()

    // Walk through each question: verify the question text, then click an option
    for (let i = 0; i < FULL_FLOW.length; i++) {
      const [buttonText] = FULL_FLOW[i]
      expect(container.textContent).toContain(EXPECTED_QUESTIONS[i])
      expect(container.textContent).toContain(`Question ${i + 1} of 5`)
      await clickButton(buttonText)
    }

    // Build expected answers map from flow definition
    const expectedAnswers: Record<string, string> = {}
    for (const [, id, value] of FULL_FLOW) {
      expectedAnswers[id] = value
    }

    expect(mocks.completeOnboarding).toHaveBeenCalledOnce()
    expect(mocks.completeOnboarding).toHaveBeenCalledWith({ answers: expectedAnswers })
  })

  it('calls mergePreferences and shows completion screen after full flow', async () => {
    await renderComponent()

    for (const [buttonText] of FULL_FLOW) {
      await clickButton(buttonText)
    }

    expect(mocks.mergePreferences).toHaveBeenCalledWith({ onboardingComplete: true })
    expect(container.textContent).toContain("You're All Set!")
    expect(container.textContent).toContain('Taking you to your personalized dashboard')
  })

  it('redirects on remount after successful completion (re-entry guard)', async () => {
    await renderComponent()

    for (const [buttonText] of FULL_FLOW) {
      await clickButton(buttonText)
    }

    // mergePreferences was called — simulate the preference being persisted
    mocks.preferences = { onboardingComplete: true }

    // Remount: the re-entry guard should redirect instead of showing the flow
    await act(async () => { root.unmount() })
    root = createRoot(container)
    await renderComponent()

    const redirect = container.querySelector('[data-testid="navigate-redirect"]')
    expect(redirect).not.toBeNull()
    expect(redirect!.getAttribute('data-to')).toBe('/')
  })

  it('progress bar advances from 0% to 80% across the 5 questions', async () => {
    await renderComponent()

    const getProgressWidth = () => {
      const bar = container.querySelector('[role="progressbar"]')
      const fill = bar?.querySelector('div')
      return fill?.style.width
    }

    expect(getProgressWidth()).toBe('0%')

    await clickButton(FULL_FLOW[0][0]) // Q1 → Q2
    expect(getProgressWidth()).toBe('20%')

    await clickButton(FULL_FLOW[1][0]) // Q2 → Q3
    expect(getProgressWidth()).toBe('40%')

    await clickButton(FULL_FLOW[2][0]) // Q3 → Q4
    expect(getProgressWidth()).toBe('60%')

    await clickButton(FULL_FLOW[3][0]) // Q4 → Q5
    expect(getProgressWidth()).toBe('80%')
  })

  it('back-and-forth navigation preserves previously selected answers', async () => {
    await renderComponent()

    // Answer Q1 and Q2
    await clickButton(FULL_FLOW[0][0])
    await clickButton(FULL_FLOW[1][0])

    // Go back to Q2, then forward again with a different answer
    await clickButton('Go back')
    expect(container.textContent).toContain(EXPECTED_QUESTIONS[1])

    await clickButton('Standard (12-15 credits)')

    // Continue with remaining questions
    await clickButton(FULL_FLOW[2][0])
    await clickButton(FULL_FLOW[3][0])
    await clickButton(FULL_FLOW[4][0])

    // Q1 answer should still be the original, Q2 should be overridden
    expect(mocks.completeOnboarding).toHaveBeenCalledWith({
      answers: {
        planning_mode: 'four_year_plan',
        credit_load: 'standard',
        schedule_preference: 'flexible',
        work_status: 'full_time',
        priority: 'graduate',
      },
    })
  })

  it('mutation failure mid-flow shows error and allows retry on the last question', async () => {
    mocks.completeOnboarding
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce({})

    await renderComponent()

    // Complete all questions — last click triggers the mutation which fails
    for (const [buttonText] of FULL_FLOW) {
      await clickButton(buttonText)
    }

    // Error is shown, completion screen is NOT shown
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).not.toContain("You're All Set!")

    // User retries by clicking a different answer on the last question
    await clickButton('Explore electives & interests')

    // Second call should succeed
    expect(mocks.completeOnboarding).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain("You're All Set!")
  })
})
