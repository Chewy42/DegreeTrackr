import { describe, expect, it } from 'vitest'
import {
  applyThemeMode,
  createAppTheme,
  readLegacyThemeMode,
  resolveThemeMode,
} from './theme'

describe('theme system', () => {
  it('prefers an explicit stored mode over legacy preferences and system settings', () => {
    expect(
      resolveThemeMode({
        storedMode: 'dark',
        legacyPreferences: JSON.stringify({ theme: 'light' }),
        systemPrefersDark: false,
      }),
    ).toBe('dark')
  })

  it('migrates a valid legacy preference when the dedicated storage key is absent', () => {
    expect(readLegacyThemeMode(JSON.stringify({ theme: 'dark' }))).toBe('dark')
    expect(
      resolveThemeMode({
        storedMode: null,
        legacyPreferences: JSON.stringify({ theme: 'dark' }),
        systemPrefersDark: false,
      }),
    ).toBe('dark')
  })

  it('applies the selected mode tokens to the document root', () => {
    const styleProperties = new Map<string, string>()
    const root = {
      dataset: {},
      style: {
        colorScheme: '',
        setProperty: (name: string, value: string) => {
          styleProperties.set(name, value)
        },
        getPropertyValue: (name: string) => styleProperties.get(name) ?? '',
      },
    } as unknown as HTMLElement

    applyThemeMode('dark', root)

    expect(root.dataset.theme).toBe('dark')
    expect(root.style.getPropertyValue('--color-surface')).toBe('18 32 46')
    expect(root.style.colorScheme).toBe('dark')
  })

  it('creates matching MUI palette modes', () => {
    expect(createAppTheme('light').palette.mode).toBe('light')
    expect(createAppTheme('dark').palette.mode).toBe('dark')
  })

  it('falls back to system preference when no stored or legacy mode exists', () => {
    expect(
      resolveThemeMode({ storedMode: null, legacyPreferences: null, systemPrefersDark: true }),
    ).toBe('dark')
    expect(
      resolveThemeMode({ storedMode: null, legacyPreferences: null, systemPrefersDark: false }),
    ).toBe('light')
  })

  it('ignores malformed legacy preference JSON and falls back to system', () => {
    expect(
      resolveThemeMode({
        storedMode: null,
        legacyPreferences: 'not-valid-json',
        systemPrefersDark: true,
      }),
    ).toBe('dark')
  })

  it('ignores an unknown stored mode value and falls through to legacy', () => {
    expect(
      resolveThemeMode({
        storedMode: 'neon',
        legacyPreferences: JSON.stringify({ theme: 'dark' }),
        systemPrefersDark: false,
      }),
    ).toBe('dark')
  })

  it('applies light mode tokens to the document root correctly', () => {
    const styleProperties = new Map<string, string>()
    const root = {
      dataset: {},
      style: {
        colorScheme: '',
        setProperty: (name: string, value: string) => { styleProperties.set(name, value) },
        getPropertyValue: (name: string) => styleProperties.get(name) ?? '',
      },
    } as unknown as HTMLElement

    applyThemeMode('light', root)

    expect(root.dataset.theme).toBe('light')
    expect(root.style.colorScheme).toBe('light')
    // Light mode surface should be white (255 255 255)
    expect(root.style.getPropertyValue('--color-surface')).toBe('255 255 255')
  })
})
