const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';

// Normalize away a trailing "/api" or "/api/" so callers can keep writing
// `${API_BASE_URL}/api/...` regardless of whether VITE_API_URL already
// includes the /api suffix (as it does in production: .../api/).
export const API_BASE_URL = rawApiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

// The public production origin, used to build per-property share links
// (GET /share/:id on the backend) so a shared link's og:/twitter: preview
// tags reflect the actual property instead of the generic site-wide ones.
export const PUBLIC_SITE_ORIGIN = 'https://karmalandtour.360eye.tech';
