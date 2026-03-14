import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider, useAuth as useClerkAuth } from '@clerk/react'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import { getConvexClient } from './lib/convex/client'
import { getConvexProviderState } from './lib/convex/config'
import { ConvexClerkProviderBoundary } from './lib/convex/provider'
import { AppThemeProvider } from './theme/AppThemeProvider'
import './index.css'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')
}

const convexClient = getConvexClient()
const convexState = getConvexProviderState()

const appInner = (
  <AppThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </AppThemeProvider>
)

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary resetOnNavigate>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
        {convexState === 'ready' && convexClient ? (
          <ConvexClerkProviderBoundary client={convexClient} useAuth={useClerkAuth}>
            {appInner}
          </ConvexClerkProviderBoundary>
        ) : (
          appInner
        )}
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
