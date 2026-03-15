// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ExploreChat from './ExploreChat'

const mocks = vi.hoisted(() => ({
  getSessionMessages: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ jwt: 'test-jwt' }),
}))

vi.mock('../lib/convex', () => ({
  getSessionMessagesConvex: mocks.getSessionMessages,
  sendCurrentExploreMessageConvex: mocks.sendMessage,
}))

// Stub markdown renderer to avoid jsdom rendering complexity
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('span', { 'data-testid': 'markdown' }, children),
}))
vi.mock('remark-gfm', () => ({ default: () => {} }))

const SEND_RESULT = {
  session: { id: 'session-1' },
  messages: [
    { role: 'user' as const, content: 'What can I do with my major?', createdAt: Date.now() },
    { role: 'assistant' as const, content: 'Great question!', createdAt: Date.now() },
  ],
  suggestions: ['Tell me more', 'What about grad school?'],
}

describe('ExploreChat', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    // JSDOM doesn't implement Element.scrollTo
    Element.prototype.scrollTo = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.getSessionMessages.mockResolvedValue([])
    mocks.sendMessage.mockResolvedValue(SEND_RESULT)
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function render(sessionId: string | null = null, onSessionChange = vi.fn()) {
    await act(async () => {
      root.render(<ExploreChat sessionId={sessionId} onSessionChange={onSessionChange} />)
    })
  }

  function getBtn(text: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      b.textContent?.includes(text),
    )
  }

  it('shows empty state when there are no messages', async () => {
    await render()
    expect(container.textContent).toContain('Start a new exploration')
  })

  it('renders the message input with correct aria-label', async () => {
    await render()
    const input = container.querySelector('input[aria-label="Message to AI advisor"]')
    expect(input).not.toBeNull()
  })

  it('send button is disabled on empty input and enabled after typing', async () => {
    await render()
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Message to AI advisor"]')!
    const sendBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Send message"]')!

    expect(sendBtn.disabled).toBe(true)

    // React-controlled input requires the native value setter trick
    const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      nativeValueSetter?.call(input, 'hello world')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(sendBtn.disabled).toBe(false)
  })

  it('calls sendCurrentExploreMessageConvex with jwt and message when a suggestion is clicked', async () => {
    await render()
    const suggestionBtn = getBtn('What can I do with my major?')!
    await act(async () => { suggestionBtn.click() })

    expect(mocks.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ jwt: 'test-jwt', message: 'What can I do with my major?' }),
    )
  })

  it('shows the retry button after a send failure — DT18 regression', async () => {
    mocks.sendMessage.mockRejectedValueOnce(new Error('Network error'))
    await render()

    const suggestionBtn = getBtn('What can I do with my major?')!
    await act(async () => { suggestionBtn.click() })

    expect(getBtn('Retry last message')).not.toBeUndefined()
  })

  it('does not display duplicate error messages after a failure — DT18 regression', async () => {
    mocks.sendMessage.mockRejectedValueOnce(new Error('Network error'))
    await render()

    const suggestionBtn = getBtn('What can I do with my major?')!
    await act(async () => { suggestionBtn.click() })

    const errorPhrase = 'Sorry, I encountered an error'
    const occurrences = (container.textContent ?? '').split(errorPhrase).length - 1
    expect(occurrences).toBe(1)
  })

  it('shows the AI loading indicator while a response is pending', async () => {
    let resolve!: (v: typeof SEND_RESULT) => void
    const deferred = new Promise<typeof SEND_RESULT>(res => { resolve = res })
    mocks.sendMessage.mockReturnValueOnce(deferred)

    await render()
    const suggestionBtn = getBtn('What can I do with my major?')!

    // Non-async act: synchronous state updates (loading=true) are flushed
    // but the awaited sendMessage promise is still in flight
    act(() => { suggestionBtn.click() })

    const srOnlyEls = Array.from(container.querySelectorAll<HTMLElement>('.sr-only'))
    const loadingEl = srOnlyEls.find(el => el.textContent?.includes('AI advisor is responding'))
    expect(loadingEl).not.toBeUndefined()

    // Resolve to avoid dangling promise
    await act(async () => { resolve(SEND_RESULT) })
  })

  it('typing indicator disappears once the AI response arrives', async () => {
    let resolve!: (v: typeof SEND_RESULT) => void
    const deferred = new Promise<typeof SEND_RESULT>(res => { resolve = res })
    mocks.sendMessage.mockReturnValueOnce(deferred)

    await render()
    const suggestionBtn = getBtn('What can I do with my major?')!

    // Non-async act: synchronous state updates (loading=true) flush but the
    // awaited sendMessage promise stays in flight
    act(() => { suggestionBtn.click() })

    const getSrOnly = () =>
      Array.from(container.querySelectorAll<HTMLElement>('.sr-only'))

    // Indicator must be visible while loading
    expect(
      getSrOnly().find(el => el.textContent?.includes('AI advisor is responding'))
    ).not.toBeUndefined()

    // Resolve the response
    await act(async () => { resolve(SEND_RESULT) })

    // Indicator must be gone after response arrives
    expect(
      getSrOnly().find(el => el.textContent?.includes('AI advisor is responding'))
    ).toBeUndefined()
  })

  it('clicking New Chat resets to the empty state', async () => {
    await render()

    // First send a message so there are messages present
    const suggestionBtn = getBtn('What can I do with my major?')!
    await act(async () => { suggestionBtn.click() })

    // Now click New Chat
    const newChatBtn = getBtn('New Chat')!
    await act(async () => { newChatBtn.click() })

    expect(container.textContent).toContain('Start a new exploration')
  })

  it('calls onSessionChange(null) when New Chat is clicked', async () => {
    const onSessionChange = vi.fn()
    await render('session-existing', onSessionChange)

    const newChatBtn = getBtn('New Chat')!
    await act(async () => { newChatBtn.click() })

    expect(onSessionChange).toHaveBeenCalledWith(null)
  })

  it('calls onSessionChange with the new session id after the first message is sent', async () => {
    const onSessionChange = vi.fn()
    await render(null, onSessionChange)

    const suggestionBtn = getBtn('What can I do with my major?')!
    await act(async () => { suggestionBtn.click() })

    expect(onSessionChange).toHaveBeenCalledWith('session-1')
  })

  it('does not call onSessionChange again when a follow-up message uses the same session', async () => {
    const onSessionChange = vi.fn()
    // Render with the session id that matches SEND_RESULT.session.id.
    // Suggestions are cleared when a sessionId is set, so use the input field directly.
    await render('session-1', onSessionChange)

    const input = container.querySelector<HTMLInputElement>('input[aria-label="Message to AI advisor"]')!
    const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      nativeValueSetter?.call(input, 'follow-up question')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const sendBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Send message"]')!
    await act(async () => { sendBtn.click() })

    // response.session.id === currentSessionId → onSessionChange must not fire
    expect(onSessionChange).not.toHaveBeenCalled()
  })

  it('renders user and assistant messages in the list after a successful send', async () => {
    await render()
    const suggestionBtn = getBtn('What can I do with my major?')!
    await act(async () => { suggestionBtn.click() })

    // SEND_RESULT contains a user message and an assistant reply
    expect(container.textContent).toContain('What can I do with my major?')
    expect(container.textContent).toContain('Great question!')
  })

  // ── Mobile 375px responsive ─────────────────────────────────────────────

  it('message bubbles have break-words and overflow-hidden for 375px safety', async () => {
    mocks.sendMessage.mockResolvedValueOnce(SEND_RESULT)
    await render()
    const suggestionBtn = getBtn('What can I do with my major?')!
    await act(async () => { suggestionBtn.click() })

    const bubbles = Array.from(container.querySelectorAll('[class*="max-w-"]'))
      .filter(el => el.className.includes('rounded-2xl'))
    expect(bubbles.length).toBeGreaterThan(0)
    for (const bubble of bubbles) {
      expect(bubble.className).toContain('break-words')
      expect(bubble.className).toContain('overflow-hidden')
      expect(bubble.className).toContain('min-w-0')
    }
  })

  it('send button meets 44px minimum touch target', async () => {
    await render()
    const sendBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Send message"]')!
    expect(sendBtn.className).toContain('min-h-[44px]')
    expect(sendBtn.className).toContain('min-w-[44px]')
  })

  it('suggestion pills meet 44px minimum touch target height', async () => {
    await render()
    const pills = Array.from(container.querySelectorAll('button')).filter(b =>
      b.className.includes('rounded-full') && b.className.includes('bg-brand-50'),
    )
    expect(pills.length).toBeGreaterThan(0)
    for (const pill of pills) {
      expect(pill.className).toContain('min-h-[44px]')
    }
  })

  it('input has min-w-0 to prevent flex overflow', async () => {
    await render()
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Message to AI advisor"]')!
    expect(input.className).toContain('min-w-0')
  })

  // ── Dark mode ─────────────────────────────────────────────────────────────

  it('renders without hard-coded bg-white class in dark theme', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    await render()
    const allClassNames = Array.from(container.querySelectorAll('[class]'))
      .map(el => el.getAttribute('class') ?? '')
      .join(' ')
    expect(allClassNames).not.toContain('bg-white')
    document.documentElement.removeAttribute('data-theme')
  })
})
