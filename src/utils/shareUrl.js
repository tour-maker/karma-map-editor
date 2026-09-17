// Returns the current URL for outward-facing share/contact messages, falling back to the
// public site root when on an admin route so admin URLs never leak into shared text.
export function getPublicShareUrl() {
  if (typeof window === 'undefined') return '';
  if (window.location.pathname.startsWith('/admin')) {
    return `${window.location.origin}/`;
  }
  return window.location.href;
}
