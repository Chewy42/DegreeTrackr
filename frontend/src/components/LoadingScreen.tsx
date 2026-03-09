import React from "react";

export default function LoadingScreen() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
			<div role="status" aria-live="polite" className="animate-pulse text-sm tracking-wide">Preparing your DegreeTrackr workspace...</div>
		</div>
	);
}


