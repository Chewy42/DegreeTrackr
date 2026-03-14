import React, { useCallback, useState } from "react";
import { FiUploadCloud, FiFileText, FiEye, FiArrowRight, FiExternalLink, FiLoader } from "react-icons/fi";
import { useAuth } from "../auth/AuthContext";
import { convexApi, getConvexClient, buildLegacyProgramEvaluationPreviewUrl, replaceCurrentProgramEvaluationFromUpload } from "../lib/convex";

type UploadState = "idle" | "uploading" | "uploaded";

type Props = {
  onSuccess?: () => void;
};

export default function ProgramEvaluationUpload({ onSuccess }: Props) {
  const { jwt, mergePreferences, signOut } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetPreviewUrl = () => {
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    const candidate = files[0];
    if (!candidate) {
      return;
    }
    if (!candidate.name.toLowerCase().endsWith(".pdf")) {
      setError("Upload a single PDF file.");
      setFile(null);
      return;
    }
    setError(null);
    setFile(candidate);
    setUploadState("idle");
  }, []);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  const handleUpload = async () => {
    if (!file || !jwt || uploadState === "uploading") {
      return;
    }

    const convexClient = getConvexClient();
    if (!convexClient) {
      setError("Program evaluation uploads require the Convex-backed app runtime.");
      return;
    }

    setUploadState("uploading");
    setError(null);
    try {
      await replaceCurrentProgramEvaluationFromUpload({
        jwt,
        file,
        replaceProgramEvaluation: (args) =>
          convexClient.mutation(convexApi.evaluations.replaceCurrentProgramEvaluationFromUpload, args),
      });

      mergePreferences({ hasProgramEvaluation: true, onboardingComplete: false });
      setUploadState("uploaded");
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      if (err instanceof Error && /401|403/.test(err.message)) {
        signOut();
        return;
      }

      setError(err instanceof Error ? err.message : "Unable to upload file.");
      setUploadState("idle");
    }
  };

  const handleOpenPreview = async () => {
    // Only allow preview after a successful upload
    if (!jwt || uploadState !== "uploaded") {
      return;
    }
    resetPreviewUrl();
    setPreviewUrl(buildLegacyProgramEvaluationPreviewUrl(jwt));
  };

	const hasSelectedFile = !!file;
	const isUploading = uploadState === "uploading";

	return (
		<div className="space-y-8">
			{/* Instructions Section */}
			<div className="rounded-2xl border border-primary/15 bg-primary/10 p-6 sm:p-8">
				<div className="text-center mb-6">
					<h3 className="text-lg sm:text-xl font-bold text-text-primary">Where is my Program Evaluation?</h3>
					<a
						href="https://studentcenter.chapman.edu"
						target="_blank"
						rel="noopener noreferrer"
						className="mt-2 inline-flex items-center gap-2 text-base font-medium text-primary hover:text-primary-emphasis sm:text-lg"
					>
						Chapman Student Center <FiExternalLink />
					</a>
				</div>

				<div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12 py-4">
					<div className="relative group flex-1 w-full">
						<img
							src="/onboarding_image_1.png"
							alt="Step 1"
							className="aspect-video w-full rounded-xl shadow-md border border-slate-200/60 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
						/>
					</div>
					<div className="text-primary/35 rotate-90 flex-shrink-0 sm:rotate-0">
						<FiArrowRight className="w-12 h-12 sm:w-16 sm:h-16" />
					</div>
					<div className="relative group flex-1 w-full">
						<img
							src="/onboarding_image_2.png"
							alt="Step 2"
							className="aspect-video w-full rounded-xl shadow-md border border-slate-200/60 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
						/>
					</div>
				</div>
			</div>

			{/* Upload Area */}
			<div>
				<div className="relative rounded-3xl overflow-hidden">
					{/* Loading Overlay */}
					{isUploading && (
							<div role="status" aria-live="polite" className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface/75 backdrop-blur-[2px]">
								<div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-border-subtle bg-surface px-8 py-7 text-center shadow-xl sm:max-w-lg sm:px-10 sm:py-8">
									<div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-5" aria-hidden="true">
										<div className="absolute inset-0 rounded-full border-4 border-primary/20" />
										<div className="absolute inset-0 animate-spin rounded-full border-4 border-primary border-t-transparent" />
										<FiUploadCloud className="absolute inset-0 m-auto h-6 w-6 text-primary sm:h-7 sm:w-7" />
									</div>
									<p className="text-lg sm:text-xl font-semibold text-text-primary">
										Uploading your evaluation...
									</p>
									<p className="mt-3 text-sm sm:text-base text-text-secondary max-w-prose">
										This may take a moment. Please wait while we process your file.
									</p>
								</div>
							</div>
				)}

				<div
					role="button"
					tabIndex={isUploading ? -1 : 0}
					aria-disabled={isUploading}
					aria-label="Upload your program evaluation PDF"
					className={[
						"flex flex-col items-center justify-center rounded-3xl border-3 border-dashed px-8 py-16 sm:px-12 sm:py-20 transition-all duration-200",
						isUploading
							? "cursor-not-allowed border-border-subtle bg-surface-muted opacity-60"
							: isDragging
								? "cursor-pointer border-primary bg-primary/10"
								: "cursor-pointer border-primary/30 bg-surface-elevated hover:border-primary hover:bg-primary/10",
					].join(" ")}
					onDrop={isUploading ? undefined : handleDrop}
					onDragOver={isUploading ? undefined : handleDragOver}
					onDragLeave={isUploading ? undefined : handleDragLeave}
					onKeyDown={(event) => {
						if (isUploading) return;
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							const input = document.getElementById(
								"program-evaluation-file-input"
							) as HTMLInputElement | null;
							if (input) input.click();
						}
					}}
					onClick={() => {
						if (isUploading) return;
						const input = document.getElementById(
							"program-evaluation-file-input"
						) as HTMLInputElement | null;
						if (input) {
							input.click();
						}
					}}
				>
					<div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary">
						<FiUploadCloud className="text-4xl" />
					</div>
					<div className="text-xl sm:text-2xl font-semibold text-text-primary text-center">
						Drag and drop your program evaluation PDF here
					</div>
					<div className="mt-3 text-base sm:text-lg text-text-secondary text-center">
						Or click to browse files. Only one PDF is stored per account.
					</div>
					{hasSelectedFile ? (
						<div className="mt-6 inline-flex items-center rounded-full bg-primary/10 px-6 py-3 text-base font-medium text-primary">
							<FiFileText className="mr-3 text-xl" />
							<span className="truncate max-w-[300px]">{file.name}</span>
						</div>
					) : null}
					</div>
				</div>
				<input
					id="program-evaluation-file-input"
					type="file"
					accept=".pdf,application/pdf"
					className="hidden"
					disabled={isUploading}
					onChange={handleFileInputChange}
				/>
				<div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
					<button
						type="button"
						onClick={handleUpload}
						disabled={!hasSelectedFile || isUploading}
						aria-busy={isUploading ? true : undefined}
						className={[
							"inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base sm:text-lg font-bold shadow-sm transition-all duration-200 w-full sm:w-auto",
							isUploading
								? "cursor-wait bg-primary/55 text-primary-contrast"
								: hasSelectedFile
									? "bg-primary text-primary-contrast hover:bg-primary-emphasis hover:shadow-md transform active:scale-95"
									: "cursor-not-allowed bg-primary/35 text-primary-contrast/80",
						].join(" ")}
					>
						{isUploading && <FiLoader className="animate-spin text-xl" aria-hidden="true" />}
						{isUploading ? "Uploading..." : "Upload PDF"}
					</button>
					<button
						type="button"
						onClick={handleOpenPreview}
						disabled={uploadState !== "uploaded"}
						className={[
							"inline-flex w-full items-center justify-center rounded-xl border border-border-subtle px-6 py-4 text-base font-medium shadow-sm transition-colors duration-200 sm:w-auto sm:text-lg",
							uploadState === "uploaded"
								? "bg-surface-elevated text-text-secondary hover:bg-surface-muted hover:text-text-primary"
								: "cursor-not-allowed bg-surface-muted text-text-secondary/60",
						].join(" ")}
					>
						<FiEye className="mr-3 text-xl" aria-hidden="true" />
						Open program evaluation
					</button>
				</div>
				{error ? (
					<div role="alert" aria-live="assertive" className="mt-3 rounded-lg bg-danger/10 p-3 text-center text-sm font-medium text-danger sm:text-base">
						{error}
					</div>
				) : null}
				{previewUrl ? (
					<div className="mt-4 h-[420px] overflow-hidden rounded-2xl border border-border-subtle bg-surface-muted">
						<iframe
							title="Program evaluation"
							src={previewUrl}
							className="h-full w-full"
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
