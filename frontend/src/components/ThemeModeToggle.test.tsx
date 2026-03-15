// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AppThemeProvider } from '../theme/AppThemeProvider'
import ThemeModeToggle from './ThemeModeToggle'
import { THEME_STORAGE_KEY } from '../theme'

// Fake localStorage — jsdom exposes an empty object in this vitest setup,
// so we install a real-enough stub before any tests run.
let _store: Record<string, string> = {}
const fakeLocalStorage = {
  getItem: (key: string): string | null => _store[key] ?? null,
  setItem: (key: string, value: string): void => { _store[key] = String(value) },
  removeItem: (key: string): void => { delete _store[key] },
  clear: (): void => { _store = {} },
  get length(): number { return Object.keys(_store).length },
  key: (n: number): string | null => Object.keys(_store)[n] ?? null,
}

function stubMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: prefersDark && query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

describe('ThemeModeToggle', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', {
      writable: true,
      configurable: true,
      value: fakeLocalStorage,
    })
    stubMatchMedia(false)
  })

  beforeEach(() => {
    fakeLocalStorage.clear()
    stubMatchMedia(false)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function render(props?: React.ComponentProps<typeof ThemeModeToggle>) {
    await act(async () => {
      root.render(
        <AppThemeProvider>
          <ThemeModeToggle {...props} />
        </AppThemeProvider>
      )
    })
  }

  it('renders moon icon in light mode via aria-label "Switch to dark mode"', async () => {
    fakeLocalStorage.setItem(THEME_STORAGE_KEY, 'light')
    await render()
    expect(container.querySelector('button')!.getAttribute('aria-label')).toBe('Switch to dark mode')
  })

  it('renders sun icon in dark mode via aria-label "Switch to light mode"', async () => {
    fakeLocalStorage.setItem(THEME_STORAGE_KEY, 'dark')
    await render()
    expect(container.querySelector('button')!.getAttribute('aria-label')).toBe('Switch to light mode')
  })

  it('shows "Dark mode" text label in light mode', async () => {
    fakeLocalStorage.setItem(THEME_STORAGE_KEY, 'light')
    await render()
    expect(container.querySelector('button')!.textContent).toContain('Dark mode')
  })

  it('shows "Light mode" text label in dark mode', async () => {
    fakeLocalStorage.setItem(THEME_STORAGE_KEY, 'dark')
    await render()
    expect(container.querySelector('button')!.textContent).toContain('Light mode')
  })

  it('clicking toggles from light to dark — aria-label switches', async () => {
    fakeLocalStorage.setItem(THEME_STORAGE_KEY, 'light')
    await render()
    const button = container.querySelector('button')!
    await act(async () => { button.click() })
    expect(button.getAttribute('aria-label')).toBe('Switch to light mode')
  })

  it('clicking toggles from dark to light — aria-label switches', async () => {
    fakeLocalStorage.setItem(THEME_STORAGE_KEY, 'dark')
    await render()
    const button = container.querySelector('button')!
    await act(async () => { button.click() })
    expect(button.getAttribute('aria-label')).toBe('Switch to dark mode')
  })

  it('persists dark to localStorage after toggling from light', async () => {
    fakeLocalStorage.setItem(THEME_STORAGE_KEY, 'light')
    await render()
    await act(async () => { container.querySelector<HTMLButtonElement>('button')!.click() })
    expect(fakeLocalStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('persists light to localStorage after toggling from dark', async () => {
    fakeLocalStorage.setItem(THEME_STORAGE_KEY, 'dark')
    await render()
    await act(async () => { container.querySelector<HTMLButtonElement>('button')!.click() })
    expect(fakeLocalStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('defaults to dark mode when prefers-color-scheme: dark and no stored preference', async () => {
    stubMatchMedia(true)
    await render()
    expect(container.querySelector('button')!.getAttribute('aria-label')).toBe('Switch to light mode')
  })

  it('hides text label when collapsed=true', async () => {
    fakeLocalStorage.setItem(THEME_STORAGE_KEY, 'light')
    await render({ collapsed: true })
    expect(container.querySelector('button')!.textContent).not.toContain('Dark mode')
  })

  it('applies shell variant border class when variant="shell"', async () => {
    fakeLocalStorage.setItem(THEME_STORAGE_KEY, 'light')
    await render({ variant: 'shell' })
    expect(container.querySelector('button')!.className).toContain('border-white/15')
  })
})
