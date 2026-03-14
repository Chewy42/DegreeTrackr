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
})
