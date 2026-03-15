// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  sendCurrentExploreMessageConvex: vi.fn(),
  getSessionMessagesConvex: vi.fn(),
}))

vi.mock('../lib/convex', () => ({
  sendCurrentExploreMessageConvex: mocks.sendCurrentExploreMessageConvex,
  getSessionMessagesConvex: mocks.getSessionMessagesConvex,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ jwt: 'test-jwt-token' }),
}))

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('div', { 'data-testid': 'markdown' }, children),
}))

vi.mock('remark-gfm', () => ({ default: () => {} }))

vi.mock('react-icons/fi', () => ({
  FiSend: () => React.createElement('span', null, 'Send'),
  FiPlus: () => React.createElement('span', null, '+'),
  FiMessageSquare: () => React.createElement('span', null, 'Chat'),
  FiRefreshCw: () => React.createElement('span', null, 'Retry'),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAIResponse(courses: string[]) {
  const courseList = courses.map(c => `- ${c}`).join('\n')
  const content = `Based on your progress, I recommend:\n${courseList}\n\nThese courses align with your degree requirements.`
  return {
    session: { id: 'session-1', title: 'Recommendations' },
    messages: [
      { role: 'user' as const, content: 'What should I take next?', createdAt: Date.now() - 1000 },
      { role: 'assistant' as const, content, createdAt: Date.now() },
    ],
    suggestions: courses.slice(0, 3),
  }
}

describe('ExploreChat — schedule recommendations', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.getSessionMessagesConvex.mockResolvedValue([])
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
  })

  async function renderChat(sessionId: string | null = null) {
    const { default: ExploreChat } = await import('../components/ExploreChat')
    const onSessionChange = vi.fn()
    await act(async () => {
      root.render(<ExploreChat sessionId={sessionId} onSessionChange={onSessionChange} />)
    })
    return { onSessionChange }
  }

  it('renders AI course suggestions as clickable pills from mock response', async () => {
    const recommended = ['CPSC 301 — Algorithms', 'MATH 250 — Linear Algebra', 'PHIL 101 — Ethics']
    const response = makeAIResponse(recommended)
    mocks.sendCurrentExploreMessageConvex.mockResolvedValue(response)

    await renderChat()

    // Type a question and send
    const input = container.querySelector('input[type="text"]') as HTMLInputElement
    await act(async () => {
      // Simulate typing
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )!.set!
      nativeInputValueSetter.call(input, 'What should I take next?')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    // Submit the form
    const form = container.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    // Wait for response
    await act(async () => {
      await Promise.resolve()
    })

    // Verify AI mutation was called
    expect(mocks.sendCurrentExploreMessageConvex).toHaveBeenCalledWith(
      expect.objectContaining({ jwt: 'test-jwt-token', message: 'What should I take next?' })
    )

    // Verify suggestion pills rendered (first 3 courses)
    const buttons = Array.from(container.querySelectorAll('button'))
    const suggestionButtons = buttons.filter(b =>
      recommended.some(r => b.textContent?.includes(r))
    )
    expect(suggestionButtons.length).toBe(3)
  })

  it('clicking a suggestion pill sends it as a new message (accept)', async () => {
    const recommended = ['CPSC 301 — Algorithms', 'MATH 250 — Linear Algebra', 'PHIL 101 — Ethics']
    const response = makeAIResponse(recommended)
    mocks.sendCurrentExploreMessageConvex.mockResolvedValue(response)

    await renderChat()

    // Send initial message
    const input = container.querySelector('input[type="text"]') as HTMLInputElement
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )!.set!
      nativeInputValueSetter.call(input, 'What should I take next?')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const form = container.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    await act(async () => { await Promise.resolve() })

    // Now click the first suggestion pill (accept the recommendation)
    const followUp = makeAIResponse(['CPSC 302 — Data Structures II'])
    mocks.sendCurrentExploreMessageConvex.mockResolvedValue(followUp)

    const suggestionBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('CPSC 301')
    )
    expect(suggestionBtn).toBeTruthy()

    await act(async () => {
      suggestionBtn!.click()
    })
    await act(async () => { await Promise.resolve() })

    // Verify the accepted suggestion was sent as a new message
    expect(mocks.sendCurrentExploreMessageConvex).toHaveBeenCalledTimes(2)
    expect(mocks.sendCurrentExploreMessageConvex).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'CPSC 301 — Algorithms' })
    )
  })

  it('suggestions are cleared when a new message is sent (dismiss on action)', async () => {
    const recommended = ['CPSC 301 — Algorithms', 'MATH 250 — Linear Algebra']
    const response = makeAIResponse(recommended)
    mocks.sendCurrentExploreMessageConvex.mockResolvedValue(response)

    await renderChat()

    // Send initial message
    const input = container.querySelector('input[type="text"]') as HTMLInputElement
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )!.set!
      nativeInputValueSetter.call(input, 'What should I take next?')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const form = container.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    await act(async () => { await Promise.resolve() })

    // Suggestions should be visible
    let suggestionBtns = Array.from(container.querySelectorAll('button')).filter(b =>
      recommended.some(r => b.textContent?.includes(r))
    )
    expect(suggestionBtns.length).toBe(2)

    // Type a different message (dismiss suggestions by choosing own path)
    const newResponse = {
      session: { id: 'session-1', title: 'Custom question' },
      messages: [
        { role: 'user' as const, content: 'Tell me about electives', createdAt: Date.now() },
        { role: 'assistant' as const, content: 'Here are some electives...', createdAt: Date.now() },
      ],
      suggestions: ['Art 101', 'Music 200'],
    }
    mocks.sendCurrentExploreMessageConvex.mockResolvedValue(newResponse)

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )!.set!
      setter.call(input, 'Tell me about electives')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    await act(async () => { await Promise.resolve() })

    // Original suggestions should be gone, new ones present
    suggestionBtns = Array.from(container.querySelectorAll('button')).filter(b =>
      recommended.some(r => b.textContent?.includes(r))
    )
    expect(suggestionBtns.length).toBe(0)

    const newSuggestionBtns = Array.from(container.querySelectorAll('button')).filter(b =>
      b.textContent?.includes('Art 101') || b.textContent?.includes('Music 200')
    )
    expect(newSuggestionBtns.length).toBe(2)
  })

  it('new chat dismisses all suggestions', async () => {
    const recommended = ['CPSC 301 — Algorithms']
    const response = makeAIResponse(recommended)
    mocks.sendCurrentExploreMessageConvex.mockResolvedValue(response)

    await renderChat()

    // Send a message to get suggestions
    const input = container.querySelector('input[type="text"]') as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )!.set!
      setter.call(input, 'Recommend courses')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const form = container.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    await act(async () => { await Promise.resolve() })

    // Click "New Chat" button — dismisses AI suggestions
    const newChatBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('New Chat')
    )
    expect(newChatBtn).toBeTruthy()

    await act(async () => {
      newChatBtn!.click()
    })

    // AI recommendation suggestions gone, replaced with defaults
    const suggestionBtns = Array.from(container.querySelectorAll('button')).filter(b =>
      b.textContent?.includes('CPSC 301')
    )
    expect(suggestionBtns.length).toBe(0)

    // Default suggestions should be back
    const defaultBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('What can I do with my major?')
    )
    expect(defaultBtn).toBeTruthy()
  })

  it('renders AI response with course suggestions in the message area', async () => {
    const recommended = ['CPSC 301 — Algorithms', 'MATH 250 — Linear Algebra']
    const response = makeAIResponse(recommended)
    mocks.sendCurrentExploreMessageConvex.mockResolvedValue(response)

    await renderChat()

    const input = container.querySelector('input[type="text"]') as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )!.set!
      setter.call(input, 'What should I take?')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const form = container.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    await act(async () => { await Promise.resolve() })

    // The AI response message should contain the course recommendations
    const markdownElements = container.querySelectorAll('[data-testid="markdown"]')
    const texts = Array.from(markdownElements).map(el => el.textContent)
    const aiMessage = texts.find(t => t?.includes('CPSC 301'))
    expect(aiMessage).toBeTruthy()
    expect(aiMessage).toContain('MATH 250')
    expect(aiMessage).toContain('recommend')
  })
})
