import { API_BASE_URL } from '../config/api';

export const USER_BLOCKED_EVENT = 'karma-user-blocked';
const USER_TOKEN_KEY = 'karmaUserJWT';

let installed = false;

/** Signs the viewer out and asks the app to show the "you have been blocked" notice. */
export function showBlockedNotice() {
  try { localStorage.removeItem(USER_TOKEN_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(USER_BLOCKED_EVENT));
}

/** Wraps fetch once: any 403 USER_BLOCKED from our API (e.g. blocked mid-session) shows the notice. */
export function installUserBlockedGuard() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : (input?.url ?? String(input));
      if (response.status === 403 && url.startsWith(API_BASE_URL) && url.includes('/api/')) {
        const body = await response.clone().json().catch(() => null);
        if (body?.code === 'USER_BLOCKED') showBlockedNotice();
      }
    } catch { /* never break the request */ }
    return response;
  };
}
