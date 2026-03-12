import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiBookOpen, FiLoader, FiSearch, FiUser } from "react-icons/fi";
import { useAuth } from "../auth/AuthContext";
import { convexApi, getConvexClient, type ProgramEvaluationPayload } from "../lib/convex";

type UpcomingClass = {
  id: string;
  code: string;
  title: string;
  professor: string;
  term: string;
};

type ParsedProgramEvaluationCourse = {
  term?: string;
  subject?: string;
  number?: string;
  title?: string;
};

export function deriveUpcomingClassesFromProgramEvaluation(
  payload: ProgramEvaluationPayload | null | undefined,
): UpcomingClass[] {
  const rawCourses = payload?.parsed_data?.courses;
  if (!rawCourses || typeof rawCourses !== "object") {
    return [];
  }

  const inProgress = (rawCourses as { in_progress?: ParsedProgramEvaluationCourse[] }).in_progress;
  if (!Array.isArray(inProgress)) {
    return [];
  }

  return inProgress
    .map((course, index) => {
      const subject = course.subject?.trim() ?? "";
      const number = course.number?.trim() ?? "";
      const title = course.title?.trim() ?? "Untitled course";
      const term = course.term?.trim() ?? "In progress";
      const code = [subject, number].filter(Boolean).join(" ") || title;

      return {
        id: `${code || "course"}-${term}-${index}`,
        code,
        title,
        professor: "From program evaluation",
        term,
      } satisfies UpcomingClass;
    })
    .filter((course) => course.code.length > 0 || course.title.length > 0);
}

export default function ExploreClassesSidebar() {
  const { preferences } = useAuth();
  const [query, setQuery] = useState("");
  const [classes, setClasses] = useState<UpcomingClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUpcomingClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const convexClient = getConvexClient();
      if (!convexClient) {
        setError("Upcoming class preview requires Convex to be configured.");
        setClasses([]);
        return;
      }

      const payload = await convexClient.query(convexApi.evaluations.getCurrentProgramEvaluation, {});
      setClasses(deriveUpcomingClassesFromProgramEvaluation(payload));
    } catch (err) {
      console.error("Failed to load upcoming classes from Convex:", err);
      setError("Could not load classes from your program evaluation. Please try again later.");
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUpcomingClasses();
  }, [fetchUpcomingClasses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(
      (cls) =>
        cls.code.toLowerCase().includes(q) ||
        cls.title.toLowerCase().includes(q) ||
        cls.professor.toLowerCase().includes(q) ||
        cls.term.toLowerCase().includes(q),
    );
  }, [query, classes]);

  return (
    <aside className="flex-1 flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800 mb-2 text-center">
          Explore Upcoming Classes
        </h2>
        <div className="relative">
          <FiSearch className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search upcoming classes by course, professor, or term"
            placeholder="Search by course, prof, or term"
            className="w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {loading && (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 text-[11px] text-slate-400 mt-6">
            <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span>Loading classes…</span>
          </div>
        )}

        {!loading && error && (
          <div role="alert" aria-live="assertive" className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 mt-4 text-[11px] text-red-600">
            <FiAlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && filtered.map((cls) => (
          <div
            key={cls.id}
            className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-200 transition-colors p-3 text-xs"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <FiBookOpen className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
                {cls.code}
              </span>
              <span className="text-[10px] text-slate-500">{cls.term}</span>
            </div>
            <div className="text-[11px] text-slate-600 mb-1 line-clamp-2">{cls.title}</div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <FiUser className="h-3 w-3" aria-hidden="true" />
              <span>{cls.professor}</span>
            </div>
          </div>
        ))}

        {!loading && !error && filtered.length === 0 && classes.length > 0 && (
          <div role="status" aria-live="polite" className="text-[11px] text-slate-400 text-center mt-6">
            No matching classes found.
          </div>
        )}

        {!loading && !error && classes.length === 0 && (
          <div role="status" aria-live="polite" className="rounded-lg border border-slate-200 bg-slate-50 p-3 mt-4 text-[11px] text-slate-500">
            {preferences.hasProgramEvaluation
              ? "No in-progress courses were found in your current program evaluation yet."
              : "Upload your program evaluation to preview your in-progress coursework here."}
          </div>
        )}
      </div>
    </aside>
  );
}
