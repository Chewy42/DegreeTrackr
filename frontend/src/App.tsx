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
    preferencesReady,
    setMode,
    handleGoogleAuth,
    pendingEmail,
    resendConfirmation,
    signOut,
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
    // Gate first-run surfaces on preferences being ready — prevents a flash of the
    // upload/onboarding screen for returning users whose Convex prefs are still loading.
    if (!preferencesReady) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface-muted text-text-primary px-4">
          <div className="text-sm font-medium tracking-[0.025em] animate-pulse">
            Loading your DegreeTrackr setup...
          </div>
        </div>
      );
    }

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

    // Unknown authenticated route — show a minimal "not found" message.
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-surface-muted text-text-primary">
        <Sidebar />
        <main className="flex-1 h-full overflow-y-auto p-4 min-w-0">
          <div className="min-h-full flex items-center justify-center">
            <p className="text-sm text-text-secondary">Page not found.</p>
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
            <div className="rounded-2xl border border-border-subtle/70 bg-surface-muted/70 px-4 py-4 text-left sm:px-5">
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
              <div role="alert" aria-live="assertive" className="text-sm text-danger text-center py-2 px-3 rounded-lg bg-danger/8">
                {error}
              </div>
            ) : null}
            <SubmitButton loading={loading} onClick={() => void handleGoogleAuth()}>
              Continue with Google
            </SubmitButton>
            <div className="rounded-2xl border border-border-subtle/70 bg-surface-elevated/80 px-4 py-4 text-sm leading-6 text-text-secondary sm:px-5">
              Email/password entry has been superseded in this touched auth flow.
              Continue with Google is the supported Clerk path for both sign in and sign up.
            </div>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
