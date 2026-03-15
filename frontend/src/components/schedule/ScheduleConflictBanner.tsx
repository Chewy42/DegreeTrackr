import React from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';

export interface ConflictInfo {
  classId1: string;
  classId2: string;
  name1: string;
  name2: string;
  day: string;
}

interface ScheduleConflictBannerProps {
  conflicts: ConflictInfo[];
  onDismiss?: () => void;
}

export default function ScheduleConflictBanner({ conflicts, onDismiss }: ScheduleConflictBannerProps) {
  if (conflicts.length === 0) return null;

  // Deduplicate by class pair
  const seen = new Set<string>();
  const unique = conflicts.filter((c) => {
    const key = [c.classId1, c.classId2].sort().join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div
      role="alert"
      className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3 shadow-sm"
    >
      <FiAlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-700">Schedule Conflict</p>
        <ul className="mt-1 space-y-0.5">
          {unique.map((c, i) => (
            <li key={i} className="text-xs text-red-600">
              {c.name1} conflicts with {c.name2}
            </li>
          ))}
        </ul>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-100 transition-colors"
        >
          <FiX className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
