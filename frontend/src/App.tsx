import { SignIn, SignUp } from '@clerk/react'
import { useLocation } from 'react-router-dom'

import { getAuthHash, getClerkAppearance, resolveAuthModeFromHash } from './auth'
import { useAuth, type AuthMode } from './auth/AuthContext'
import AuthCard from './components/AuthCard'
import AuthTabs from './components/AuthTabs'
import BrandLockup from './components/BrandLockup'
import Sidebar from './components/Sidebar'
import ProgramEvaluationUpload from './components/ProgramEvaluationUpload'
import OnboardingChat from './components/OnboardingChat'
import ExploreChatLayout from './components/ExploreChatLayout'
import SettingsPage from './components/SettingsPage'
import { ProgressPage } from './components/progress'
import ScheduleBuilder from './components/schedule/ScheduleBuilder'
import { brandIdentity } from './theme'

export default function App() {
	const location = useLocation()
	const { sessionState, authError, preferences } = useAuth()
	const authMode = resolveAuthModeFromHash(location.hash)
	const clerkAppearance = getClerkAppearance(preferences.theme)

	const setAuthMode = (mode: AuthMode) => {
		if (typeof window !== 'undefined') {
			window.location.hash = getAuthHash(mode)
		}
	}

	if (sessionState === 'checking') {
		return (
			<div className="min-h-screen flex items-center justify-center bg-surface-muted text-text-primary px-4">
				<div className="text-sm font-medium tracking-[0.025em] text-center animate-pulse">
					{`Preparing your ${brandIdentity.productName} workspace...`}
				</div>
			</div>
		)
	}

	if (sessionState === 'misconfigured') {
		return (
			<div className="min-h-screen flex items-center justify-center bg-surface-muted text-text-primary px-4 py-6">
				<AuthCard
					header={<BrandLockup variant="logo" size="lg" align="center" showTagline />}
					title="Authentication setup required"
					subtitle={authError ?? `Add your ${brandIdentity.productName} Clerk configuration to continue.`}
				>
					<div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
						Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in the frontend environment before loading the app.
					</div>
				</AuthCard>
			</div>
		)
	}

	if (sessionState === 'authenticated') {
		if (!preferences.hasProgramEvaluation) {
			return (
				<div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
					<Sidebar />
					<main className="flex-1 h-full overflow-y-auto p-4 min-w-0">
						<div className="min-h-full flex items-center justify-center">
							<AuthCard
								title="Upload your program evaluation"
								subtitle={`Start by uploading your official program evaluation PDF so ${brandIdentity.productName} can understand your path.`}
								maxWidth="max-w-7xl"
							>
								<ProgramEvaluationUpload />
							</AuthCard>
						</div>
					</main>
				</div>
			)
		}

		if (!preferences.onboardingComplete) {
			return <OnboardingChat />
		}

		if (location.pathname === '/' || location.pathname === '/progress-page') {
			return (
				<div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
					<Sidebar />
					<main className="flex-1 h-full overflow-y-auto min-w-0">
						<ProgressPage />
					</main>
				</div>
			)
		}

		if (location.pathname === '/exploration-assistant') {
			return (
				<div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
					<Sidebar />
					<main className="flex-1 h-full overflow-y-auto min-w-0">
						<ExploreChatLayout />
					</main>
				</div>
			)
		}

		if (location.pathname === '/settings') {
			return (
				<div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
					<Sidebar />
					<main className="flex-1 h-full overflow-y-auto p-4 min-w-0">
						<SettingsPage />
					</main>
				</div>
			)
		}

		if (location.pathname === '/schedule-gen-home') {
			return (
				<div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
					<Sidebar />
					<main className="flex-1 h-full overflow-hidden min-w-0">
						<ScheduleBuilder />
					</main>
				</div>
			)
		}

		return (
			<div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
				<Sidebar />
					<main className="flex-1 h-full overflow-y-auto min-w-0">
						<div className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
							<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
								That page doesn&apos;t exist yet, so we&apos;ve taken you back to your progress overview.
							</div>
						</div>
						<ProgressPage />
				</main>
			</div>
		)
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-surface-muted text-text-primary px-4 py-6">
			<div className="relative w-full max-w-xl space-y-4">
				<AuthCard
					header={<BrandLockup variant="logo" size="lg" align="center" showTagline />}
					title={authMode === 'sign_up' ? 'Create your account' : 'Welcome back'}
					subtitle={`Sign in or create your ${brandIdentity.productName} account with your Chapman email.`}
				>
					<div className="mb-4 sm:mb-5">
						<AuthTabs mode={authMode} onChange={setAuthMode} />
					</div>
					{authError ? (
						<div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-center text-sm text-danger">
							{authError}
						</div>
					) : null}
					<p className="text-center text-xs text-text-secondary">
						DegreeTrackr currently provisions access for Chapman student accounts only.
					</p>
				</AuthCard>
				<div className="flex justify-center">
					{authMode === 'sign_up' ? (
						<SignUp
							appearance={clerkAppearance}
							routing="hash"
							fallbackRedirectUrl="/"
							signInUrl="/#sign-in"
						/>
					) : (
						<SignIn
							appearance={clerkAppearance}
							routing="hash"
							fallbackRedirectUrl="/"
							signUpUrl="/#sign-up"
						/>
					)}
				</div>
			</div>
		</div>
	)
}