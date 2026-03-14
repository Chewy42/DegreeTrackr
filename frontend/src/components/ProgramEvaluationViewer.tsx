import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiEye, FiRefreshCw, FiFileText, FiX, FiUploadCloud } from "react-icons/fi";
import { useAuth } from "../auth/AuthContext";
import ProgramEvaluationUpload from "./ProgramEvaluationUpload";
import { buildLegacyProgramEvaluationPreviewUrl, convexApi, getConvexClient, syncCurrentProgramEvaluationFromLegacy } from "../lib/convex";
import { LegacyBoundaryError } from "../lib/convex/legacyBoundary";

type ParsedPayload = {
  email: string;
  uploaded_at?: string;
  original_filename?: string;
  parsed_data?: Record<string, unknown>;
};

type LoadState = "idle" | "loading" | "ready" | "empty" | "error";

const formatDate = (iso?: string) => {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function ProgramEvaluationViewer() {
  const { jwt, preferences } = useAuth();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [parsed, setParsed] = useState<ParsedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const hasFile = loadState === "ready" && parsed;
  const directPdfUrl = useMemo(() => {
    if (!jwt) return null;
    return buildLegacyProgramEvaluationPreviewUrl(jwt);
  }, [jwt]);

  const revokePreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  }, [previewUrl]);

  const fetchParsed = useCallback(async () => {
    if (!jwt) return;

    const convexClient = getConvexClient();
    if (!convexClient) {
      setParsed(null);
      setLoadState("error");
      setError("Program evaluations require the Convex-backed app runtime.");
      return;
    }

    setLoadState("loading");
    setError(null);

    try {
      const nextData =
        (await convexClient.query(convexApi.evaluations.getCurrentProgramEvaluation, {})) ??
        (preferences.hasProgramEvaluation
          ? await syncCurrentProgramEvaluationFromLegacy({
              jwt,
              hydrateProgramEvaluation: (args) =>
                convexClient.action(convexApi.evaluations.hydrateCurrentProgramEvaluationFromLegacy, args),
            })
          : null);

      if (!nextData) {
        setParsed(null);
        setLoadState("empty");
        return;
      }

      setParsed(nextData as ParsedPayload);
      setLoadState("ready");
    } catch (err) {
      const message = err instanceof LegacyBoundaryError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unable to load program evaluation.";
      setError(message);
      setLoadState("error");
    }
  }, [jwt, preferences.hasProgramEvaluation]);

  const openPdfModal = useCallback(() => {
    setModalOpen(true);
    setError(null);
    setModalLoading(true);
    revokePreview();
    if (!directPdfUrl) {
      setModalLoading(false);
      setError("Missing session token. Please sign in again.");
      return;
    }
    setPreviewUrl(directPdfUrl);
  }, [directPdfUrl, revokePreview]);

  // Fetch evaluation on mount and whenever jwt/preferences change.
  useEffect(() => {
    fetchParsed();
  }, [fetchParsed]);

  // Cleanup preview URL on unmount or when revokePreview identity changes.
  // Kept separate so opening/closing the PDF modal never re-triggers fetchParsed.
  useEffect(() => {
    return revokePreview;
  }, [revokePreview]);

  const fileLabel = useMemo(() => {
    if (!parsed) return "No file on record";
    return parsed.original_filename || "Program evaluation.pdf";
  }, [parsed]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border-subtle/70 bg-surface-elevated p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
              <FiFileText className="text-xl" />
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary">Program evaluation on file</div>
              <div className="text-xs text-text-secondary">
                {hasFile ? `Uploaded ${formatDate(parsed?.uploaded_at)}` : "Upload to unlock progress insights."}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchParsed}
            aria-busy={loadState === "loading" ? true : undefined}
            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-xs font-medium text-text-primary shadow-sm transition-colors duration-150 hover:bg-surface-muted"
          >
            <FiRefreshCw className="text-sm" aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-border-subtle/70 bg-surface-muted px-4 py-3 text-sm text-text-primary">
          {loadState === "loading" ? (
            <span role="status" aria-live="polite" className="text-text-secondary">Loading program evaluation…</span>
          ) : loadState === "error" ? (
            <span role="alert" aria-live="assertive" className="text-danger text-xs">{error}</span>
          ) : loadState === "empty" ? (
            <span role="status" aria-live="polite" className="text-text-secondary">No program evaluation uploaded yet.</span>
          ) : (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="font-medium truncate">{fileLabel}</div>
              <div className="text-xs text-text-secondary">
                {parsed?.email ? `Linked to ${parsed.email}` : "Signed-in account"}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-text-secondary">
            View the stored PDF in-place. Scroll inside the modal to read it fully.
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setReplaceModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary shadow-sm transition-colors duration-150 hover:bg-surface-muted"
            >
              <FiUploadCloud className="text-sm" aria-hidden="true" />
              Replace PDF
            </button>
            <button
              type="button"
              onClick={openPdfModal}
              disabled={loadState !== "ready"}
              className={[
                "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-150",
                loadState === "ready"
                  ? "bg-primary text-primary-contrast shadow-sm hover:bg-primary-emphasis"
                  : "bg-primary/35 text-primary-contrast/80 cursor-not-allowed",
              ].join(" ")}
            >
              <FiEye className="text-sm" aria-hidden="true" />
              View PDF
            </button>
          </div>
        </div>
      </div>

      {replaceModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center px-4 py-8">
            <div role="dialog" aria-modal="true" aria-labelledby="replace-program-evaluation-title" className="relative my-auto w-full max-w-2xl rounded-2xl bg-surface shadow-2xl ring-1 ring-border-subtle p-6">
              <button
                type="button"
                onClick={() => setReplaceModalOpen(false)}
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-95 z-10"
                aria-label="Close"
              >
                <FiX className="text-lg text-text-primary" aria-hidden="true" />
              </button>
              <h2 id="replace-program-evaluation-title" className="text-lg font-semibold mb-4">Replace Program Evaluation</h2>
              <p className="mb-6 text-sm text-text-secondary">
                Uploading a new evaluation will reset your onboarding progress and chat history.
              </p>
              <ProgramEvaluationUpload onSuccess={() => {
                setReplaceModalOpen(false);
                window.location.href = "/";
              }} />
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
          <div role="dialog" aria-modal="true" aria-labelledby="program-evaluation-preview-title" className="relative w-full max-w-5xl rounded-2xl bg-surface shadow-2xl ring-1 ring-border-subtle">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                revokePreview();
              }}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-95"
              aria-label="Close"
            >
              <FiX className="text-lg text-text-primary" aria-hidden="true" />
            </button>
            <div className="px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
              <div id="program-evaluation-preview-title" className="text-sm font-semibold text-text-primary">{fileLabel}</div>
              <div className="text-xs text-text-secondary mt-0.5">
                {parsed?.email ? `For ${parsed.email}` : "Signed-in account"}
              </div>
            </div>
            <div className="h-[70vh] overflow-hidden border-t border-border-subtle/70">
              {modalLoading && !previewUrl ? (
                <div role="status" aria-live="polite" className="flex h-full items-center justify-center text-sm text-text-secondary">
                  Opening PDF…
                </div>
              ) : previewUrl ? (
                <iframe
                  title="Program evaluation"
                  src={previewUrl}
                  className="h-full w-full"
                  style={{ border: "none" }}
                  onLoad={() => setModalLoading(false)}
                  onError={() => {
                    setModalLoading(false);
                     setError("Unable to load PDF. The preview still uses the legacy document service.");
                   }}
                 />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-sm text-danger text-center">
                  <div role="alert" aria-live="assertive" className="space-y-3">
                    <div>{error || "Unable to load PDF."}</div>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={openPdfModal}
                        className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-xs font-medium text-text-primary shadow-sm transition-colors duration-150 hover:bg-surface-muted"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
