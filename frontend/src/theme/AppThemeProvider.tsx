import { CssBaseline, ThemeProvider as MuiThemeProvider } from '@mui/material'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyThemeMode,
  createAppTheme,
  LEGACY_PREFERENCES_STORAGE_KEY,
  resolveThemeMode,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from '../theme'

type AppThemeContextValue = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
}

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined)

function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return resolveThemeMode({
    storedMode: window.localStorage.getItem(THEME_STORAGE_KEY),
    legacyPreferences: window.localStorage.getItem(LEGACY_PREFERENCES_STORAGE_KEY),
    systemPrefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
  })
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialThemeMode)

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return
    }

    applyThemeMode(mode, document.documentElement)
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  }, [mode])

  const muiTheme = useMemo(() => createAppTheme(mode), [mode])
  const value = useMemo<AppThemeContextValue>(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light')),
    }),
    [mode],
  )

  return (
    <AppThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline enableColorScheme />
        {children}
      </MuiThemeProvider>
    </AppThemeContext.Provider>
  )
}

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext)

  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider')
  }

  return context
}
