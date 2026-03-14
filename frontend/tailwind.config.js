/** @type {import('tailwindcss').Config} */

const withOpacity = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand light blue theme aligned with MUI primary
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // main
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        canvas: withOpacity('--color-canvas'),
        surface: {
          DEFAULT: withOpacity('--color-surface'),
          muted: withOpacity('--color-surface-muted'),
          elevated: withOpacity('--color-surface-elevated'),
        },
        text: {
          primary: withOpacity('--color-text-primary'),
          secondary: withOpacity('--color-text-secondary'),
        },
        shell: {
          DEFAULT: withOpacity('--color-shell'),
          muted: withOpacity('--color-shell-muted'),
          contrast: withOpacity('--color-shell-contrast'),
        },
        primary: {
          DEFAULT: withOpacity('--color-primary'),
          emphasis: withOpacity('--color-primary-emphasis'),
          contrast: withOpacity('--color-primary-contrast'),
        },
        accent: {
          DEFAULT: withOpacity('--color-accent'),
          emphasis: withOpacity('--color-accent-emphasis'),
        },
        border: {
          subtle: withOpacity('--color-border-subtle'),
          strong: withOpacity('--color-border-strong'),
        },
        danger: withOpacity('--color-danger'),
        success: withOpacity('--color-success'),
        focus: withOpacity('--color-focus'),
        // Neutral slate-like text palette for other uses
        ink: {
          900: '#0f172a',
          700: '#1e293b',
          500: '#475569',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        // Subtle neutral depth for cards
        card: '0 20px 45px rgb(var(--shadow-color) / 0.12), 0 8px 18px rgb(var(--shadow-color) / 0.08)',
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '1.25rem',
          md: '1.5rem',
          lg: '2rem',
          xl: '2.5rem',
        },
      },
    },
  },
  plugins: [],
}
