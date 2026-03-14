import { FiMoon, FiSun } from 'react-icons/fi'
import { useAppTheme } from '../theme/AppThemeProvider'

type ThemeModeToggleProps = {
  variant?: 'shell' | 'surface'
  collapsed?: boolean
}

export default function ThemeModeToggle({
  variant = 'surface',
  collapsed = false,
}: ThemeModeToggleProps) {
  const { mode, toggleMode } = useAppTheme()
  const nextMode = mode === 'light' ? 'dark' : 'light'
  const Icon = mode === 'light' ? FiMoon : FiSun

  const variantClassName =
    variant === 'shell'
      ? 'border border-white/15 bg-white/10 text-shell-contrast hover:bg-white/15 focus-visible:ring-white/50 focus-visible:ring-offset-shell'
      : 'border border-border-subtle bg-surface-elevated text-text-primary hover:bg-surface-muted focus-visible:ring-focus/60 focus-visible:ring-offset-surface'

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={`Switch to ${nextMode} mode`}
      title={`Switch to ${nextMode} mode`}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium shadow-sm transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        collapsed ? 'h-10 w-10 px-0' : 'w-full',
        variantClassName,
      ].join(' ')}
    >
      <Icon className="text-base" aria-hidden="true" />
      {!collapsed ? <span>{mode === 'light' ? 'Dark mode' : 'Light mode'}</span> : null}
    </button>
  )
}
