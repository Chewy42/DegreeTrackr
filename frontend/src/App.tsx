import React from "react";
import { useLocation } from "react-router-dom";
import { AuthenticateWithRedirectCallback } from "@clerk/react";
import { useAuth } from "./auth/AuthContext";
import { CLERK_CALLBACK_PATH } from "./auth/clerkAuth";
import AuthCard from "./components/AuthCard";
import AuthTabs from "./components/AuthTabs";
import SubmitButton from "./components/SubmitButton";
import EmailConfirmationNotice from "./components/EmailConfirmationNotice";
import Sidebar from "./components/Sidebar";
import ProgramEvaluationUpload from "./components/ProgramEvaluationUpload";
import OnboardingChat from "./components/OnboardingChat";
import ExploreChatLayout from "./components/ExploreChatLayout";
import SettingsPage from "./components/SettingsPage";
import { ProgressPage } from "./components/progress";
import ScheduleBuilder from "./components/schedule/ScheduleBuilder";

export default function App() {
  const location = useLocation();
  const {
    sessionState,
    mode,
    auth,
    loading,
    error,
    preferences,
    setMode,
    handleGoogleAuth,
    pendingEmail,
    resendConfirmation,
    signOut,
    retryBackendConnection,
  } = useAuth();

  if (location.pathname === CLERK_CALLBACK_PATH) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-muted text-text-primary px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <AuthenticateWithRedirectCallback />
          <div id="clerk-captcha" />
          <div className="text-sm font-medium tracking-[0.025em] animate-pulse">
            Finishing your Google sign-in...
          </div>
        </div>
      </div>
    );
  }

  if (sessionState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-muted text-text-primary px-4">
        <div className="text-sm font-medium tracking-[0.025em] text-center animate-pulse">
          Preparing your DegreeTrackr workspace...
        </div>
      </div>
    );
  }

  if (sessionState === "backend_unavailable") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-muted text-text-primary px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Service Temporarily Unavailable</h2>
            <p className="text-text-secondary text-sm">
              We're having trouble connecting to our servers. This is usually temporary.
              Please try again in a moment.
            </p>
          </div>
          <button
            onClick={retryBackendConnection}
            className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (sessionState === "legacy_bridge_required") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-muted text-text-primary px-4">
        <div className="max-w-xl w-full rounded-3xl border border-amber-200 bg-white p-8 shadow-sm space-y-5">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold">Legacy bridge setup required</h2>
            <p className="text-sm text-text-secondary">
              This frontend can boot on its own, but Clerk session exchange and the
              remaining legacy <code>/api/*</code> flows still need an explicit
              <code> VITE_API_BASE_URL </code>
              or injected runtime <code>apiBaseUrl</code>.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-text-secondary">
            Configure the bridge URL, then reload to continue with sign-in, program evaluation,
            schedule generation, and explore flows.
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={signOut}
              className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sessionState === "pending_confirmation") {
    return (
      <EmailConfirmationNotice
        email={pendingEmail || auth.email}
        onResend={resendConfirmation}
        onBack={signOut}
      />
    );
  }

  if (sessionState === "authenticated") {
    if (!preferences.hasProgramEvaluation) {
      return (
        <div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
          <Sidebar />
          <main className="flex-1 h-full overflow-y-auto p-4 min-w-0">
            <div className="min-h-full flex items-center justify-center">
              <AuthCard
                title="Upload your program evaluation"
                subtitle="Start by uploading your official program evaluation PDF so DegreeTrackr can understand your path."
                maxWidth="max-w-7xl"
              >
                <ProgramEvaluationUpload />
              </AuthCard>
            </div>
          </main>
        </div>
      );
    }

    if (!preferences.onboardingComplete) {
      return <OnboardingChat />;
    }

    // Home and Progress page use full-width layout with ProgressPage (dashboard)
    if (location.pathname === "/" || location.pathname === "/progress-page") {
      return (
        <div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
          <Sidebar />
          <main className="flex-1 h-full overflow-y-auto min-w-0">
            <ProgressPage />
          </main>
        </div>
      );
    }

    if (location.pathname === "/exploration-assistant") {
      return (
        <div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
          <Sidebar />
          <main className="flex-1 h-full overflow-y-auto min-w-0">
            <ExploreChatLayout />
          </main>
        </div>
      );
    }

    if (location.pathname === "/settings") {
      return (
        <div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
          <Sidebar />
          <main className="flex-1 h-full overflow-y-auto p-4 min-w-0">
            <SettingsPage />
          </main>
        </div>
      );
    }

    if (location.pathname === "/schedule-gen-home") {
      return (
        <div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
          <Sidebar />
          <main className="flex-1 h-full overflow-hidden min-w-0">
            <ScheduleBuilder />
          </main>
        </div>
      );
    }

    let title = "Welcome to DegreeTrackr";
    let subtitle = "You are signed in. Next: connect session state and onboarding.";
    let body: React.ReactNode = (
      <div className="text-sm text-text-secondary text-center py-1">
        This placeholder view confirms authentication flow is working.
      </div>
    );

    return (
      <div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
        <Sidebar />
        <main className="flex-1 h-full overflow-y-auto p-4 min-w-0">
          <div className="min-h-full flex items-center justify-center">
            <AuthCard
              title={title}
              subtitle={subtitle}
            >
              {body}
            </AuthCard>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted text-text-primary px-4 py-6">
      <div className="relative w-full max-w-xl">
        <AuthCard
          title="DegreeTrackr"
          subtitle="Sign in or create your account to continue"
        >
          <div className="mb-4 sm:mb-5">
            <AuthTabs mode={mode} onChange={setMode} />
          </div>
          <div className="space-y-4 sm:space-y-5">
            <div className="rounded-2xl border border-slate-200/70 bg-surface-muted/60 px-4 py-4 text-left sm:px-5">
              <h2 className="text-base sm:text-lg font-semibold text-text-primary">
                {mode === "sign_in"
                  ? "Sign in with your Chapman Google account"
                  : "Create your account with your Chapman Google account"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {mode === "sign_in"
                  ? "Use your Chapman Google account to continue with Clerk."
                  : "Use your Chapman Google account to create your Clerk-backed account and continue."}
              </p>
            </div>
            {error ? (
              <div role="alert" aria-live="assertive" className="text-sm text-danger text-center py-2 px-3 rounded-lg bg-[rgba(239,68,68,0.08)]">
                {error}
              </div>
            ) : null}
            <SubmitButton loading={loading} onClick={() => void handleGoogleAuth()}>
              Continue with Google
            </SubmitButton>
            <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-4 text-sm leading-6 text-text-secondary sm:px-5">
              Email/password entry has been superseded in this touched auth flow.
              Continue with Google is the supported Clerk path for both sign in and sign up.
            </div>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
