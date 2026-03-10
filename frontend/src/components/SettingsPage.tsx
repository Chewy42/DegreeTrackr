import React, { useCallback, useEffect, useState } from "react";
import { usePageTitle } from "../hooks/usePageTitle";
import { FiLogOut, FiCheck, FiRefreshCw, FiSettings, FiAlertCircle } from "react-icons/fi";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "../auth/AuthContext";
import AuthCard from "./AuthCard";
import ProgramEvaluationViewer from "./ProgramEvaluationViewer";
import { convexApi } from "../lib/convex/api";
import { isConvexFeatureEnabled } from "../lib/convex/config";
import type { SchedulingPreferencesFormValues } from "../lib/convex/contracts";

type SchedulingPreferences = {
  planning_mode?: string | null;
  credit_load?: string | null;
  schedule_preference?: string | null;
  work_status?: string | null;
  priority?: string | null;
};

type PreferenceOption = {
  label: string;
  value: string;
};

type PreferenceConfig = {
  id: keyof SchedulingPreferences;
  title: string;
  description: string;
  options: PreferenceOption[];
};

const PREFERENCE_CONFIGS: PreferenceConfig[] = [
  {
    id: "planning_mode",
    title: "Planning Focus",
    description: "What would you like to focus on?",
    options: [
      { label: "📅 Plan next semester", value: "upcoming_semester" },
      { label: "🎓 4-year plan", value: "four_year_plan" },
      { label: "📊 View progress", value: "view_progress" },
    ],
  },
  {
    id: "credit_load",
    title: "Credit Load",
    description: "How many credits per semester?",
    options: [
      { label: "Light (9-12)", value: "light" },
      { label: "Standard (12-15)", value: "standard" },
      { label: "Heavy (15-18)", value: "heavy" },
    ],
  },
  {
    id: "schedule_preference",
    title: "Class Timing",
    description: "When do you prefer classes?",
    options: [
      { label: "🌅 Mornings", value: "mornings" },
      { label: "☀️ Afternoons", value: "afternoons" },
      { label: "🔄 Flexible", value: "flexible" },
    ],
  },
  {
    id: "work_status",
    title: "Work Commitment",
    description: "Do you have work obligations?",
    options: [
      { label: "💼 Part-time", value: "part_time" },
      { label: "🏢 Full-time", value: "full_time" },
      { label: "📚 No work", value: "none" },
    ],
  },
  {
    id: "priority",
    title: "Academic Priority",
    description: "What's your main focus?",
    options: [
      { label: "🎯 Major requirements", value: "major" },
      { label: "🌟 Electives", value: "electives" },
      { label: "🏁 Graduate on time", value: "graduate" },
    ],
  },
];

export default function SettingsPage() {
  usePageTitle("Settings");
  const { signOut, jwt } = useAuth();
  const [preferences, setPreferences] = useState<SchedulingPreferences>({});
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [savingField, setSavingField] = useState<string | null>(null);
  const [successField, setSuccessField] = useState<string | null>(null);
  const [saveErrorField, setSaveErrorField] = useState<string | null>(null);

  const convexSchedulingPrefs = useQuery(
    convexApi.profile.getCurrentSchedulingPreferences,
    isConvexFeatureEnabled() ? {} : "skip",
  );
  const updateSchedulingPrefs = useMutation(convexApi.profile.updateCurrentSchedulingPreferences);

  // Sync Convex query results into local state when data arrives
  useEffect(() => {
    if (convexSchedulingPrefs != null) {
      setPreferences(convexSchedulingPrefs);
      setLoadState("ready");
    }
  }, [convexSchedulingPrefs]);

  const fetchPreferences = useCallback(async () => {
    if (!jwt) return;
    // If Convex already provided data, skip the Flask fetch
    if (convexSchedulingPrefs != null) {
      setLoadState("ready");
      return;
    }
    setLoadState("loading");
    try {
      const res = await fetch("/api/auth/scheduling-preferences", {
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(data);
        setLoadState("ready");
      } else {
        setLoadState("error");
      }
    } catch {
      setLoadState("error");
    }
  }, [jwt, convexSchedulingPrefs]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreference = async (field: keyof SchedulingPreferences, value: string) => {
    if (!jwt || savingField) return;

    setSavingField(field);
    setSuccessField(null);
    setSaveErrorField(null);

    let saved = false;

    // Try Convex first
    if (isConvexFeatureEnabled()) {
      try {
        await updateSchedulingPrefs({ patch: { [field]: value } as SchedulingPreferencesFormValues });
        saved = true;
      } catch {
        // Fall through to Flask
      }
    }

    // Fall back to Flask if Convex failed or is disabled
    if (!saved) {
      try {
        const res = await fetch("/api/auth/scheduling-preferences", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ [field]: value }),
        });
        if (res.ok) {
          saved = true;
        }
      } catch {
        // Silent fail - user can try again
      }
    }

    if (saved) {
      setPreferences((prev) => ({ ...prev, [field]: value }));
      setSuccessField(field);
      setTimeout(() => setSuccessField(null), 2000);
    } else {
      setSaveErrorField(field);
      setTimeout(() => setSaveErrorField(null), 3000);
    }

    setSavingField(null);
  };

  return (
    <div className="min-h-full flex items-center justify-center py-8">
      <AuthCard
        title="Settings"
        subtitle="Adjust your DegreeTrackr experience."
        maxWidth="max-w-3xl"
      >
        <div className="space-y-8">
          <ProgramEvaluationViewer />

          {/* Scheduling Preferences Section */}
          <div className="pt-8 border-t border-slate-200/70">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FiSettings className="text-lg" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Scheduling Preferences</h3>
                  <p className="text-sm text-text-secondary">Update your schedule planning preferences</p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchPreferences}
                disabled={loadState === "loading"}
                aria-busy={loadState === "loading" ? true : undefined}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-text-primary ring-1 ring-slate-200 shadow-sm transition-colors duration-150 hover:bg-slate-50 disabled:opacity-50"
              >
                <FiRefreshCw className={`text-sm ${loadState === "loading" ? "animate-spin" : ""}`} aria-hidden="true" />
                Refresh
              </button>
            </div>

            {loadState === "loading" && !Object.keys(preferences).length ? (
              <div role="status" aria-live="polite" className="rounded-2xl border border-slate-200/70 bg-slate-50 p-6 text-center text-sm text-text-secondary">
                Loading preferences…
              </div>
            ) : loadState === "error" ? (
              <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200/70 bg-red-50 p-6 text-center text-sm text-red-600">
                Unable to load preferences. Please try again.
              </div>
            ) : (
              <div className="space-y-4">
                {PREFERENCE_CONFIGS.map((config) => (
                  <div
                    key={config.id}
                    className="rounded-2xl border border-slate-200/70 bg-white shadow-sm p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{config.title}</div>
                        <div className="text-xs text-text-secondary">{config.description}</div>
                      </div>
                      {savingField === config.id && (
                        <div role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs text-blue-600">
                          <FiRefreshCw className="text-sm animate-spin" aria-hidden="true" />
                          Saving…
                        </div>
                      )}
                      {successField === config.id && (
                        <div role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs text-green-600">
                          <FiCheck className="text-sm" aria-hidden="true" />
                          Saved
                        </div>
                      )}
                      {saveErrorField === config.id && (
                        <div className="flex items-center gap-1.5 text-xs text-red-600" role="alert">
                          <FiAlertCircle className="text-sm" aria-hidden="true" />
                          Save failed
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {config.options.map((option) => {
                        const isSelected = preferences[config.id] === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => updatePreference(config.id, option.value)}
                            disabled={savingField !== null}
                            className={[
                              "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150",
                              isSelected
                                ? "bg-blue-600 text-white shadow-sm"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                              savingField !== null ? "opacity-60 cursor-not-allowed" : "",
                            ].join(" ")}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account Section */}
          <div className="pt-8 border-t border-slate-200/70">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Account</h3>
            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              <div>
                <div className="font-medium text-text-primary">Sign Out</div>
                <div className="text-sm text-text-secondary">
                  Sign out of your account on this device.
                </div>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-danger bg-red-50 hover:bg-red-100 transition-colors duration-150"
              >
                <FiLogOut className="text-lg" aria-hidden="true" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </AuthCard>
    </div>
  );
}
