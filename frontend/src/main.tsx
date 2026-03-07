import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')
}

createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
                <ErrorBoundary resetOnNavigate>
                        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
                                <AuthProvider>
                                        <BrowserRouter>
                                                <App />
                                        </BrowserRouter>
                                </AuthProvider>
                        </ClerkProvider>
                </ErrorBoundary>
        </React.StrictMode>
)
