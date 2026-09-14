const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';

// Normalize away a trailing "/api" or "/api/" so callers can keep writing
// `${API_BASE_URL}/api/...` regardless of whether VITE_API_URL already
// includes the /api suffix (as it does in production: .../api/).
export const API_BASE_URL = rawApiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
