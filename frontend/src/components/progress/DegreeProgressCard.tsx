import React, { useState } from "react";

interface DegreeProgressCardProps {
  progress: number;
  totalCredits: number;
  earnedCredits: number;
  inProgressCredits: number;
  hasEvaluation?: boolean;
  programName?: string;
}

export default function DegreeProgressCard({
  progress,
  totalCredits,
  earnedCredits,
  inProgressCredits,
  hasEvaluation = true,
  programName,
}: DegreeProgressCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExport = () => {
    const lines = [
      programName ? `Program: ${programName}` : "Degree Progress Summary",
      `Completion: ${progress}%`,
      `Earned Credits: ${earnedCredits.toFixed(1)}`,
      `In Progress Credits: ${inProgressCredits.toFixed(1)}`,
      `Total Required Credits: ${totalCredits.toFixed(1)}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "degree-progress.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasEvaluation) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
          <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">No progress data yet</p>
            <p className="text-xs text-slate-500 mt-1">Upload your transcript to see progress</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate stroke properties for circular progress
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  // Color based on progress
  const getProgressColor = (p: number) => {
    if (p >= 75) return "#10b981"; // green
    if (p >= 50) return "#3b82f6"; // blue
    if (p >= 25) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  const progressColor = getProgressColor(progress);
  const inProgressPercent = totalCredits > 0 ? (inProgressCredits / totalCredits) * 100 : 0;
  const totalProgressPercent = Math.min(progress + inProgressPercent, 100);
  const earnedShare = totalProgressPercent > 0 ? (progress / totalProgressPercent) * 100 : 100;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all duration-300 group">
      <div className="flex items-center gap-4">
        {/* Circular Progress */}
        <div className="relative flex-shrink-0">
          <svg
            width={size}
            height={size}
            className="transform -rotate-90 transition-transform duration-300 group-hover:scale-105"
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={progressColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{
                filter: `drop-shadow(0 0 6px ${progressColor}40)`,
              }}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-2xl font-bold transition-colors duration-300"
              style={{ color: progressColor }}
            >
              {progress}%
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Complete</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Degree Progress</h3>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Earned</span>
              <span className="font-medium text-emerald-600">{earnedCredits.toFixed(1)} cr</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">In Progress</span>
              <span className="font-medium text-blue-600">{inProgressCredits.toFixed(1)} cr</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Total Required</span>
              <span className="font-medium text-slate-700">{totalCredits.toFixed(1)} cr</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar underneath */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div
          className="h-2 bg-slate-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(totalProgressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Degree progress: ${Math.round(totalProgressPercent)}%`}
        >
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${totalProgressPercent}%`,
              background: `linear-gradient(90deg, ${progressColor} ${earnedShare}%, #93c5fd ${earnedShare}%)`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg py-1.5 transition-colors duration-150"
        >
          {copied ? "Copied!" : "Copy share link"}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="flex-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg py-1.5 transition-colors duration-150"
        >
          Export summary
        </button>
      </div>
    </div>
  );
}
