// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { THEME_STORAGE_KEY } from '../theme'
import { AppThemeProvider, useAppTheme } from '../theme/AppThemeProvider'

// Mock localStorage — vitest jsdom does not provide a full Storage implementation
const storageMap = new Map<string, string>()
const localStorageMock: Storage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => { storageMap.set(key, value) },
  removeItem: (key: string) => { storageMap.delete(key) },
  clear: () => storageMap.clear(),
  get length() { return storageMap.size },
  key: (index: number) => [...storageMap.keys()][index] ?? null,
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

// matchMedia stub
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  storageMap.clear()
  // Reset data-theme on documentElement
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.colorScheme = ''
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

/** Test helper that renders children inside AppThemeProvider and exposes the theme context. */
function ThemeConsumer({ onContext }: { onContext: (ctx: ReturnType<typeof useAppTheme>) => void }) {
  const ctx = useAppTheme()
  onContext(ctx)
  return <div data-testid="child">themed child</div>
}

describe('AppThemeProvider', () => {
  it('renders children in light mode by default', () => {
    let capturedMode: string | undefined

    act(() => {
      root.render(
        <AppThemeProvider>
          <ThemeConsumer onContext={(ctx) => { capturedMode = ctx.mode }} />
        </AppThemeProvider>,
      )
    })

    expect(capturedMode).toBe('light')
    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe('themed child')
  })

  it('applies dark mode data-theme attribute when dark theme is set', () => {
    // Pre-seed localStorage with dark mode
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    let capturedMode: string | undefined

    act(() => {
      root.render(
        <AppThemeProvider>
          <ThemeConsumer onContext={(ctx) => { capturedMode = ctx.mode }} />
        </AppThemeProvider>,
      )
    })

    expect(capturedMode).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('toggleMode switches from light to dark and updates data-theme', () => {
    let toggle: (() => void) | undefined
    let capturedMode: string | undefined

    act(() => {
      root.render(
        <AppThemeProvider>
          <ThemeConsumer
            onContext={(ctx) => {
              capturedMode = ctx.mode
              toggle = ctx.toggleMode
            }}
          />
        </AppThemeProvider>,
      )
    })

    expect(capturedMode).toBe('light')

    // Toggle to dark
    act(() => toggle!())

    expect(capturedMode).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    // Toggle back to light
    act(() => toggle!())

    expect(capturedMode).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('persists theme choice to localStorage on mode change', () => {
    let setMode: ((mode: 'light' | 'dark') => void) | undefined

    act(() => {
      root.render(
        <AppThemeProvider>
          <ThemeConsumer onContext={(ctx) => { setMode = ctx.setMode }} />
        </AppThemeProvider>,
      )
    })

    // Default should persist light
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

    // Change to dark
    act(() => setMode!('dark'))

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    // Change back to light
    act(() => setMode!('light'))

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('children receive correct theme context value', () => {
    let capturedContext: ReturnType<typeof useAppTheme> | undefined

    act(() => {
      root.render(
        <AppThemeProvider>
          <ThemeConsumer onContext={(ctx) => { capturedContext = ctx }} />
        </AppThemeProvider>,
      )
    })

    expect(capturedContext).toBeDefined()
    expect(capturedContext!.mode).toBe('light')
    expect(typeof capturedContext!.setMode).toBe('function')
    expect(typeof capturedContext!.toggleMode).toBe('function')
  })
})
