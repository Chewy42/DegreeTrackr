import { createTheme } from '@mui/material/styles'

export type ThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'degreetrackr.theme'
export const LEGACY_PREFERENCES_STORAGE_KEY = 'degreetrackr.preferences'

type ThemeColorTokens = Record<string, string>

const baseTypography = [
  'Inter',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'sans-serif',
].join(',')

export const themeColorTokens: Record<ThemeMode, ThemeColorTokens> = {
  light: {
    'color-canvas': '242 246 251',
    'color-surface': '255 255 255',
    'color-surface-muted': '234 240 246',
    'color-surface-elevated': '249 251 254',
    'color-border-subtle': '206 217 229',
    'color-border-strong': '160 177 194',
    'color-text-primary': '22 36 50',
    'color-text-secondary': '87 103 120',
    'color-shell': '20 54 79',
    'color-shell-muted': '27 68 97',
    'color-shell-contrast': '242 247 251',
    'color-primary': '26 86 126',
    'color-primary-emphasis': '19 69 102',
    'color-primary-contrast': '247 250 253',
    'color-accent': '181 138 51',
    'color-accent-emphasis': '149 113 31',
    'color-danger': '185 59 59',
    'color-success': '42 124 88',
    'color-focus': '94 145 181',
    'shadow-color': '15 23 42',
    'gradient-start': '247 250 253',
    'gradient-end': '229 237 246',
  },
  dark: {
    'color-canvas': '9 19 29',
    'color-surface': '18 32 46',
    'color-surface-muted': '24 42 58',
    'color-surface-elevated': '29 49 67',
    'color-border-subtle': '60 82 103',
    'color-border-strong': '89 115 138',
    'color-text-primary': '232 239 246',
    'color-text-secondary': '169 185 201',
    'color-shell': '6 15 24',
    'color-shell-muted': '14 31 46',
    'color-shell-contrast': '232 239 246',
    'color-primary': '111 174 214',
    'color-primary-emphasis': '134 190 225',
    'color-primary-contrast': '6 15 24',
    'color-accent': '225 191 104',
    'color-accent-emphasis': '238 210 133',
    'color-danger': '248 113 113',
    'color-success': '74 222 128',
    'color-focus': '126 178 214',
    'shadow-color': '2 8 16',
    'gradient-start': '8 16 26',
    'gradient-end': '18 33 48',
  },
}

type ResolveThemeModeOptions = {
  storedMode: string | null
  legacyPreferences: string | null
  systemPrefersDark: boolean
}

function rgb(token: string): string {
  return `rgb(${token})`
}

function getToken(tokens: ThemeColorTokens, key: string): string {
  const token = tokens[key]

  if (!token) {
    throw new Error(`Missing theme token: ${key}`)
  }

  return token
}

export function parseThemeMode(value: unknown): ThemeMode | null {
  return value === 'light' || value === 'dark' ? value : null
}

export function readLegacyThemeMode(legacyPreferences: string | null): ThemeMode | null {
  if (!legacyPreferences) {
    return null
  }

  try {
    const parsed = JSON.parse(legacyPreferences) as { theme?: unknown }
    return parseThemeMode(parsed.theme)
  } catch {
    return null
  }
}

export function resolveThemeMode({
  storedMode,
  legacyPreferences,
  systemPrefersDark,
}: ResolveThemeModeOptions): ThemeMode {
  return (
    parseThemeMode(storedMode) ??
    readLegacyThemeMode(legacyPreferences) ??
    (systemPrefersDark ? 'dark' : 'light')
  )
}

export function applyThemeMode(mode: ThemeMode, root: HTMLElement): void {
  const tokens = themeColorTokens[mode]

  root.dataset.theme = mode
  root.style.colorScheme = mode

  for (const [tokenName, tokenValue] of Object.entries(tokens)) {
    root.style.setProperty(`--${tokenName}`, tokenValue)
  }
}

export function createAppTheme(mode: ThemeMode) {
  const tokens = themeColorTokens[mode]
  const primary = getToken(tokens, 'color-primary')
  const primaryContrast = getToken(tokens, 'color-primary-contrast')
  const accent = getToken(tokens, 'color-accent')
  const canvas = getToken(tokens, 'color-canvas')
  const surface = getToken(tokens, 'color-surface')
  const textPrimary = getToken(tokens, 'color-text-primary')
  const textSecondary = getToken(tokens, 'color-text-secondary')
  const borderSubtle = getToken(tokens, 'color-border-subtle')
  const danger = getToken(tokens, 'color-danger')
  const success = getToken(tokens, 'color-success')
  const gradientStart = getToken(tokens, 'gradient-start')
  const gradientEnd = getToken(tokens, 'gradient-end')

  return createTheme({
    palette: {
      mode,
      primary: {
        main: rgb(primary),
        contrastText: rgb(primaryContrast),
      },
      secondary: {
        main: rgb(accent),
      },
      background: {
        default: rgb(canvas),
        paper: rgb(surface),
      },
      text: {
        primary: rgb(textPrimary),
        secondary: rgb(textSecondary),
      },
      divider: rgb(borderSubtle),
      error: {
        main: rgb(danger),
      },
      success: {
        main: rgb(success),
      },
    },
    shape: {
      borderRadius: 18,
    },
    typography: {
      fontFamily: baseTypography,
      h1: {
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      h4: {
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      h6: {
        fontWeight: 600,
      },
      button: {
        fontWeight: 600,
        textTransform: 'none',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: rgb(canvas),
            backgroundImage: `radial-gradient(circle at top, rgb(${gradientEnd}) 0%, rgb(${gradientStart}) 52%, rgb(${canvas}) 100%)`,
            color: rgb(textPrimary),
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  })
}
