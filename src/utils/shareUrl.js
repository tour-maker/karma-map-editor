import { API_BASE_URL } from '../config/api';

// Returns the current URL for outward-facing share/contact messages, falling back to the
// public site root when on an admin route so admin URLs never leak into shared text.
export function getPublicShareUrl() {
  if (typeof window === 'undefined') return '';
  if (window.location.pathname.startsWith('/admin')) {
    return `${window.location.origin}/`;
  }
  return window.location.href;
}

// Points a specific plot's share link at the backend's /share/:id route instead of the
// app URL directly, so link previews (WhatsApp, etc.) get that plot's real live data —
// the app itself only ever sees the app URL after the backend's redirect.
export function getPlotShareUrl(featureId) {
  if (!featureId) return getPublicShareUrl();
  return `${API_BASE_URL}/share/${encodeURIComponent(featureId)}`;
}
