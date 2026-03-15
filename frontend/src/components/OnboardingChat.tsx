import React, { useState, useEffect, useRef } from "react";
import { Navigate } from 'react-router-dom';
import {
  FiCheckCircle,
  FiCpu,
  FiUploadCloud,
  FiRefreshCw,
  FiArrowRight
} from "react-icons/fi";
import { useMutation } from "convex/react";
import { useAuth } from "../auth/AuthContext";
import { convexApi } from "../lib/convex/api";
import type { SchedulingPreferencesFormValues } from "../lib/convex/contracts";
import { deleteCurrentProgramEvaluationBoundary, getConvexClient } from "../lib/convex";

const ONBOARDING_STORAGE_KEY = "degreetrackr.onboarding_progress";

// Static onboarding questions with button options
type OnboardingQuestion = {
  id: string;
  question: string;
  options: { label: string; value: string }[];
};

const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "planning_mode",
    question: "What would you like to focus on today?",
    options: [
      { label: "📅 Plan my next semester", value: "upcoming_semester" },
      { label: "🎓 Create a 4-year plan", value: "four_year_plan" },
      { label: "📊 View my progress", value: "view_progress" },
    ],
  },
  {
    id: "credit_load",
    question: "How many credits do you typically take per semester?",
    options: [
      { label: "Light (9-12 credits)", value: "light" },
      { label: "Standard (12-15 credits)", value: "standard" },
      { label: "Heavy (15-18 credits)", value: "heavy" },
    ],
  },
  {
    id: "schedule_preference",
    question: "When do you prefer to take classes?",
    options: [
      { label: "🌅 Mornings", value: "mornings" },
      { label: "☀️ Afternoons", value: "afternoons" },
      { label: "🔄 Flexible / No preference", value: "flexible" },
    ],
  },
  {
    id: "work_status",
    question: "Do you have any work commitments?",
    options: [
      { label: "💼 Part-time job", value: "part_time" },
      { label: "🏢 Full-time job", value: "full_time" },
      { label: "📚 No work - focusing on studies", value: "none" },
    ],
  },
  {
    id: "priority",
    question: "What's your main priority right now?",
    options: [
      { label: "🎯 Complete major requirements", value: "major" },
      { label: "🌟 Explore electives & interests", value: "electives" },
      { label: "🏁 Graduate on time", value: "graduate" },
    ],
  },
];

type OnboardingAnswers = Record<string, string>;

export default function OnboardingChat() {
  const { jwt, mergePreferences, preferences } = useAuth();
  const completeOnboarding = useMutation(convexApi.profile.completeCurrentOnboarding);

  // Re-entry guard: if the user has already completed onboarding, send them
  // to the dashboard rather than showing the onboarding flow again.
  if (preferences.onboardingComplete) {
    return <Navigate to="/" replace />;
  }

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    try {
      const saved = sessionStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { index?: unknown; answers?: unknown };
        const idx = typeof parsed.index === "number" ? parsed.index : 0;
        return idx < ONBOARDING_QUESTIONS.length ? idx : 0;
      }
    } catch { /* ignore */ }
    return 0;
  });
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => {
    try {
      const saved = sessionStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { index?: unknown; answers?: unknown };
        if (parsed.answers != null && typeof parsed.answers === "object") {
          return parsed.answers as OnboardingAnswers;
        }
      }
    } catch { /* ignore */ }
    return {};
  });
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  // Persist in-progress answers to sessionStorage so the user can resume if they leave mid-flow
  useEffect(() => {
    try {
      sessionStorage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify({ index: currentQuestionIndex, answers }),
      );
    } catch { /* ignore */ }
  }, [currentQuestionIndex, answers]);

  // Move focus to the first option button when the question advances
  useEffect(() => {
    firstOptionRef.current?.focus();
  }, [currentQuestionIndex]);

  const currentQuestion = ONBOARDING_QUESTIONS[currentQuestionIndex];
  const progressPercent = Math.round(((currentQuestionIndex) / ONBOARDING_QUESTIONS.length) * 100);

  const handleOptionClick = (questionId: string, value: string) => {
    // Save the answer
    setFinishError(null);
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

    // Move to next question or complete
    if (currentQuestionIndex < ONBOARDING_QUESTIONS.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // All questions answered - complete onboarding
      handleFinish({ ...answers, [questionId]: value });
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    if (!window.confirm("Start over? This will reset your answers.")) {
      return;
    }
    try { sessionStorage.removeItem(ONBOARDING_STORAGE_KEY); } catch { /* ignore */ }
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIsComplete(false);
  };

  const handleReupload = async () => {
    if (!jwt || loading) return;
    const convexClient = getConvexClient();
    if (!convexClient) {
      setFinishError("Program evaluation changes require the Convex-backed app runtime.");
      return;
    }
    if (!window.confirm("This will delete your current transcript data and return you to the upload screen. Continue?")) {
      return;
    }

    setLoading(true);
    try {
      await deleteCurrentProgramEvaluationBoundary({
        jwt,
        clearProgramEvaluation: () =>
          convexClient.mutation(convexApi.evaluations.clearCurrentProgramEvaluation, {}),
      });

      mergePreferences({ hasProgramEvaluation: false, onboardingComplete: false });
      window.location.reload();
    } catch (err) {
      console.error("Reupload delete failed", err);
      setFinishError(err instanceof Error ? err.message : "Unable to reset your program evaluation.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async (finalAnswers: OnboardingAnswers) => {
    if (loading) return;
    setLoading(true);

    try {
      await completeOnboarding({ answers: finalAnswers as SchedulingPreferencesFormValues });
      mergePreferences({ onboardingComplete: true });
      try { sessionStorage.removeItem(ONBOARDING_STORAGE_KEY); } catch { /* ignore */ }
      setIsComplete(true);
    } catch (err) {
      console.error("Finish failed", err);
      setFinishError("Something went wrong saving your preferences. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Completion screen - redirect happens via preferences change
  if (isComplete) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 p-4 md:p-8">
        <div className="flex flex-col items-center justify-center w-full max-w-lg p-8 bg-white rounded-2xl shadow-xl">
          <div className="h-20 w-20 rounded-2xl bg-green-600 flex items-center justify-center shadow-lg">
            <FiCheckCircle className="text-4xl text-white" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-800">You're All Set!</h2>
          <p className="mt-3 text-lg text-slate-500 text-center">
            Taking you to your personalized dashboard...
          </p>
          <div className="mt-6 flex gap-2">
            <div className="h-2 w-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="h-2 w-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="h-2 w-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 p-4 md:p-8">
      <div className="flex flex-col w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">

        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-6 md:px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Logo & Title */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
                <FiCpu className="text-2xl" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                  Quick Setup
                </h1>
                <p className="text-sm md:text-base text-slate-500 mt-0.5">
                  Answer a few questions to personalize your experience
                </p>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="hidden md:flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={loading || currentQuestionIndex === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiRefreshCw className={`text-lg ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
                Start Over
              </button>
              <button
                type="button"
                onClick={handleReupload}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiUploadCloud className="text-lg" aria-hidden="true" />
                New Evaluation
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div
            role="progressbar"
            aria-valuenow={currentQuestionIndex + 1}
            aria-valuemin={1}
            aria-valuemax={ONBOARDING_QUESTIONS.length}
            aria-label={`Onboarding progress: question ${currentQuestionIndex + 1} of ${ONBOARDING_QUESTIONS.length}`}
            className="mt-5 h-2 w-full bg-slate-200 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Question {currentQuestionIndex + 1} of {ONBOARDING_QUESTIONS.length}
          </p>
        </div>

        {/* Question Area */}
        <div className="flex-1 bg-slate-50 p-6 md:p-8" aria-live="polite">
          {currentQuestion && (
            <div className="space-y-6">
              {/* Question */}
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
                    <FiCpu className="text-white text-xl" />
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-2xl px-6 py-5 shadow-sm border border-slate-200">
                  <h2 className="text-xl md:text-2xl font-semibold text-slate-800">
                    {currentQuestion.question}
                  </h2>
                </div>
              </div>

              {/* Finish error */}
              {finishError && (
                <div role="alert" className="pl-16">
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    {finishError}
                  </p>
                </div>
              )}

              {loading && (
                <div role="status" aria-live="polite" aria-label="Loading response" className="pl-16">
                  <p className="text-sm text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-4 py-3">
                    Saving your answer…
                  </p>
                </div>
              )}

              {/* Options as Buttons */}
              <div className="space-y-3 pl-16">
                {currentQuestion.options.map((option, idx) => (
                  <button
                    key={option.value}
                    ref={idx === 0 ? firstOptionRef : undefined}
                    type="button"
                    onClick={() => handleOptionClick(currentQuestion.id, option.value)}
                    disabled={loading}
                    className="w-full flex items-center justify-between gap-4 px-6 py-4 rounded-xl bg-white text-slate-700 text-lg font-medium hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all border-2 border-slate-200 text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <span>{option.label}</span>
                    <FiArrowRight className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" aria-hidden="true" />
                  </button>
                ))}
              </div>

              {/* Back Button */}
              {currentQuestionIndex > 0 && (
                <div className="pl-16 pt-4">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={loading}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                  >
                    ← Go back
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Action Buttons */}
        <div className="flex md:hidden items-center justify-center gap-6 p-4 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={handleReset}
            disabled={loading || currentQuestionIndex === 0}
            className="inline-flex items-center gap-2 px-4 min-h-[44px] text-sm font-medium text-slate-500 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`text-lg ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Start Over
          </button>
          <div className="h-5 w-px bg-slate-300" aria-hidden="true" />
          <button
            type="button"
            onClick={handleReupload}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 min-h-[44px] text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            <FiUploadCloud className="text-lg" aria-hidden="true" />
            New Evaluation
          </button>
        </div>
      </div>
    </div>
  );
}
