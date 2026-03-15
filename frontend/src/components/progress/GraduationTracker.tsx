import React from 'react';

export interface GraduationTrackerProps {
  expectedGradYear: number;
  creditsCompleted: number;
  creditsExpected: number;
  threshold?: number;
  totalCourses?: number;
}

type TrackStatus = 'On Track' | 'Ahead' | 'Behind';

function getStatus(completed: number, expected: number, threshold: number): TrackStatus {
  if (completed > expected + threshold) return 'Ahead';
  if (completed < expected - threshold) return 'Behind';
  return 'On Track';
}

export default function GraduationTracker({
  expectedGradYear,
  creditsCompleted,
  creditsExpected,
  threshold = 3,
  totalCourses = 0,
}: GraduationTrackerProps) {
  const status = getStatus(creditsCompleted, creditsExpected, threshold);

  const statusColor: Record<TrackStatus, string> = {
    'On Track': 'text-green-700 bg-green-50 border-green-200',
    Ahead: 'text-blue-700 bg-blue-50 border-blue-200',
    Behind: 'text-amber-700 bg-amber-50 border-amber-200',
  };

  return (
    <div
      data-testid="graduation-tracker"
      className={`rounded-xl border px-4 py-3 ${statusColor[status]}`}
    >
      <p className="text-sm font-semibold">
        Expected Graduation: <span data-testid="grad-year">{expectedGradYear}</span>
      </p>
      <p className="text-xs mt-1">
        Status: <span data-testid="track-status">{status}</span>
      </p>
      <p className="text-xs mt-0.5">
        {creditsCompleted}/{creditsExpected} credits
        {totalCourses > 0 && ` · ${totalCourses} courses`}
      </p>
    </div>
  );
}
