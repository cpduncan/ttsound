/**
 * "Compact" = phone-sized layout. MUST match the media query in styles.css
 * (`@media (max-width: 700px), (max-height: 500px)`), which also catches phones in landscape.
 */
export const COMPACT_QUERY = '(max-width: 700px), (max-height: 500px)';

export function isCompact(): boolean {
  try {
    return window.matchMedia(COMPACT_QUERY).matches;
  } catch {
    return false;
  }
}
