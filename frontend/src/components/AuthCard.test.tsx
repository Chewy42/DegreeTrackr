// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AuthCard from './AuthCard'

describe('AuthCard', () => {
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

  async function render(props: React.ComponentProps<typeof AuthCard>) {
    await act(async () => {
      root.render(<AuthCard {...props} />)
    })
  }

  it('renders the title in an h1', async () => {
    await render({ title: 'Welcome Back', children: <span /> })
    expect(container.querySelector('h1')?.textContent).toBe('Welcome Back')
  })

  it('renders children inside the card body', async () => {
    await render({ title: 'Test', children: <span data-testid="child">hello</span> })
    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe('hello')
  })

  it('renders subtitle when provided', async () => {
    await render({ title: 'Test', subtitle: 'A helpful subtitle', children: <span /> })
    expect(container.textContent).toContain('A helpful subtitle')
  })

  it('does not render a subtitle paragraph when subtitle is omitted', async () => {
    await render({ title: 'Test', children: <span /> })
    // No <p> elements when children is just a span and no subtitle is given
    expect(container.querySelectorAll('p').length).toBe(0)
  })

  it('renders footer content when provided', async () => {
    await render({
      title: 'Test',
      children: <span />,
      footer: <a href="/login">Go to login</a>,
    })
    expect(container.textContent).toContain('Go to login')
  })

  it('does not render a second divider when footer is omitted', async () => {
    await render({ title: 'Test', children: <span /> })
    // One divider between header and body only
    expect(container.querySelectorAll('.h-px').length).toBe(1)
  })

  it('renders two dividers when footer is provided', async () => {
    await render({ title: 'Test', children: <span />, footer: <span>footer</span> })
    expect(container.querySelectorAll('.h-px').length).toBe(2)
  })

  it('applies the default max-w-xl width class on the outer wrapper', async () => {
    await render({ title: 'Test', children: <span /> })
    const outer = container.querySelector<HTMLDivElement>('div')!
    expect(outer.className).toContain('max-w-xl')
  })

  it('applies a custom maxWidth class when provided', async () => {
    await render({ title: 'Test', children: <span />, maxWidth: 'max-w-sm' })
    const outer = container.querySelector<HTMLDivElement>('div')!
    expect(outer.className).toContain('max-w-sm')
    expect(outer.className).not.toContain('max-w-xl')
  })
})
