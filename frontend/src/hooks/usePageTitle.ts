import { useEffect } from 'react';

const APP_NAME = 'DegreeTrackr';

/**
 * Sets the browser tab title for the current view.
 * Automatically appends " | DegreeTrackr" so every tab has context.
 * Resets to just "DegreeTrackr" on unmount.
 *
 * @example
 * usePageTitle('Schedule Builder');  // → "Schedule Builder | DegreeTrackr"
 * usePageTitle(null);                // → "DegreeTrackr"
 */
export function usePageTitle(pageTitle: string | null): void {
  useEffect(() => {
    const prev = document.title;
    document.title = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = prev;
    };
  }, [pageTitle]);
}
