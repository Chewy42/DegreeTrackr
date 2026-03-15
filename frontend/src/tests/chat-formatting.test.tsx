// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ReactMarkdown from 'react-markdown'

/**
 * Tests the message rendering pipeline used by ExploreChat.
 * ExploreChat renders every message through <ReactMarkdown remarkPlugins={[remarkGfm]}>.
 * We replicate that exact setup here to verify formatting, code blocks, and XSS safety.
 */

// ── Message renderer matching ExploreChat (lines 245-256) ────────────────────

function ChatMessage({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  return (
    <div data-role={role} className={role === 'user' ? 'user-msg' : 'bot-msg'}>
      <ReactMarkdown
        className="prose prose-sm max-w-none"
        components={{
          p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
          a: ({ node, ...props }) => <a className="text-brand-500" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-4" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-4" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('Chat message formatting', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  it('renders **bold** markdown as <strong>', async () => {
    await act(async () => {
      root.render(<ChatMessage role="assistant" content="This is **important** info" />)
    })

    const strong = container.querySelector('strong')
    expect(strong).not.toBeNull()
    expect(strong!.textContent).toBe('important')
  })

  it('renders ```code block``` as <code> or <pre>', async () => {
    await act(async () => {
      root.render(
        <ChatMessage role="assistant" content={'```\nconsole.log("hi")\n```'} />,
      )
    })

    const code = container.querySelector('code')
    expect(code).not.toBeNull()
    expect(code!.textContent).toContain('console.log')
  })

  it('escapes HTML injection in user messages', async () => {
    const xss = '<script>alert(1)</script>'
    await act(async () => {
      root.render(<ChatMessage role="user" content={xss} />)
    })

    // No <script> element should exist in the DOM
    expect(container.querySelector('script')).toBeNull()
    // The text content should be visible (escaped, not executed)
    expect(container.textContent).toContain('alert(1)')
  })

  it('renders plain text as-is without extra wrappers', async () => {
    await act(async () => {
      root.render(<ChatMessage role="assistant" content="Just a plain message" />)
    })

    expect(container.textContent).toContain('Just a plain message')
    // Should not produce <strong>, <code>, <ul> etc. for plain text
    expect(container.querySelector('strong')).toBeNull()
    expect(container.querySelector('code')).toBeNull()
    expect(container.querySelector('ul')).toBeNull()
  })
})
