// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ExploreChat from '../components/ExploreChat'

const HISTORY = [
  { role: 'user' as const, content: 'What are my options?', createdAt: 1000 },
  { role: 'assistant' as const, content: 'You have several paths.', createdAt: 2000 },
  { role: 'user' as const, content: 'Tell me more about CS.', createdAt: 3000 },
]

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

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('span', { 'data-testid': 'markdown' }, children),
}))
vi.mock('remark-gfm', () => ({ default: () => {} }))

describe('ExploreChat message persistence — DT144', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.getSessionMessages.mockResolvedValue(HISTORY)
    mocks.sendMessage.mockResolvedValue({
      session: { id: 'session-1' },
      messages: [
        ...HISTORY,
        { role: 'user' as const, content: 'New message', createdAt: 4000 },
        { role: 'assistant' as const, content: 'New reply', createdAt: 5000 },
      ],
      suggestions: [],
    })
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function render(sessionId: string | null = 'session-1', onSessionChange = vi.fn()) {
    await act(async () => {
      root.render(React.createElement(ExploreChat, { sessionId, onSessionChange }))
    })
  }

  it('loads and displays all 3 messages from chat history', async () => {
    await render()

    expect(container.textContent).toContain('What are my options?')
    expect(container.textContent).toContain('You have several paths.')
    expect(container.textContent).toContain('Tell me more about CS.')
    expect(mocks.getSessionMessages).toHaveBeenCalledWith('session-1')
  })

  it('messages persist after unmount and remount with same session', async () => {
    await render()
    expect(container.textContent).toContain('You have several paths.')

    // Unmount
    await act(async () => { root.unmount() })

    // Remount fresh
    root = createRoot(container)
    mocks.getSessionMessages.mockResolvedValue(HISTORY)
    await render()

    expect(container.textContent).toContain('What are my options?')
    expect(container.textContent).toContain('You have several paths.')
    expect(container.textContent).toContain('Tell me more about CS.')
  })

  it('sends a new message via sendCurrentExploreMessageConvex', async () => {
    await render()

    const input = container.querySelector<HTMLInputElement>('input[aria-label="Message to AI advisor"]')!
    const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set

    await act(async () => {
      nativeValueSetter?.call(input, 'New message')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const sendBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Send message"]')!
    await act(async () => { sendBtn.click() })

    expect(mocks.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ jwt: 'test-jwt', message: 'New message', sessionId: 'session-1' }),
    )
  })

  it('clears messages and resets to empty state on New Chat', async () => {
    const onSessionChange = vi.fn()
    await render('session-1', onSessionChange)

    expect(container.textContent).toContain('You have several paths.')

    const newChatBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find(b => b.textContent?.includes('New Chat'))!

    await act(async () => { newChatBtn.click() })

    expect(container.textContent).toContain('Start a new exploration')
    expect(container.textContent).not.toContain('You have several paths.')
    expect(onSessionChange).toHaveBeenCalledWith(null)
  })
})
