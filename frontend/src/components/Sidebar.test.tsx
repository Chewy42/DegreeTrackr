// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import Sidebar from './Sidebar'

const mockPathname = { value: '/' }

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
  useLocation: () => ({ pathname: mockPathname.value }),
}))

vi.mock('./ThemeModeToggle', () => ({
  default: () => <div data-testid="theme-toggle" />,
}))

describe('Sidebar', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mockPathname.value = '/'
    // Reset window width to desktop
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function render() {
    await act(async () => { root.render(<Sidebar />) })
  }

  it('renders main navigation landmark', async () => {
    await render()
    expect(container.querySelector('nav[aria-label="Main navigation"]')).not.toBeNull()
  })

  it('renders all 4 nav links', async () => {
    await render()
    const links = container.querySelectorAll('a[href]')
    expect(links.length).toBeGreaterThanOrEqual(4)
  })

  it('renders the Home link', async () => {
    await render()
    const homeLink = Array.from(container.querySelectorAll('a')).find(a => a.textContent?.includes('Home'))
    expect(homeLink).not.toBeUndefined()
  })

  it('renders the Settings link', async () => {
    await render()
    const settingsLink = Array.from(container.querySelectorAll('a')).find(a => a.textContent?.includes('Settings'))
    expect(settingsLink).not.toBeUndefined()
  })

  it('renders DegreeTrackr brand text when expanded', async () => {
    await render()
    expect(container.textContent).toContain('DegreeTrackr')
  })

  it('renders expand/collapse toggle button', async () => {
    await render()
    const btn = container.querySelector('button[aria-expanded]')
    expect(btn).not.toBeNull()
  })

  it('toggle button has aria-expanded=true when expanded', async () => {
    await render()
    const btn = container.querySelector<HTMLButtonElement>('button[aria-expanded]')!
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('collapses sidebar on toggle button click', async () => {
    await render()
    const btn = container.querySelector<HTMLButtonElement>('button[aria-expanded]')!
    await act(async () => { btn.click() })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('re-expands sidebar on second toggle click', async () => {
    await render()
    const btn = container.querySelector<HTMLButtonElement>('button[aria-expanded]')!
    await act(async () => { btn.click() })
    await act(async () => { btn.click() })
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('hides DegreeTrackr brand text when collapsed', async () => {
    await render()
    const btn = container.querySelector<HTMLButtonElement>('button[aria-expanded]')!
    await act(async () => { btn.click() })
    // After collapse the brand span is not rendered
    const spans = Array.from(container.querySelectorAll('span')).filter(
      s => s.textContent === 'DegreeTrackr',
    )
    expect(spans).toHaveLength(0)
  })

  it('applies w-64 class when expanded and w-20 when collapsed', async () => {
    await render()
    const aside = container.querySelector('aside')!
    expect(aside.className).toContain('w-64')
    const btn = container.querySelector<HTMLButtonElement>('button[aria-expanded]')!
    await act(async () => { btn.click() })
    expect(aside.className).toContain('w-20')
  })

  it('renders ThemeModeToggle', async () => {
    await render()
    expect(container.querySelector('[data-testid="theme-toggle"]')).not.toBeNull()
  })
})
