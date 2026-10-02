import toast from 'react-hot-toast';
import { useMapStore } from '../store/useMapStore';
import { API_BASE_URL } from '../config/api';

const ADMIN_TOKEN_KEY = 'karmaAdminJWT';
const RENEWED_TOKEN_HEADER = 'x-renewed-token';
const WATCH_INTERVAL_MS = 5 * 60 * 1000;

let guardInstalled = false;

/**
 * Ends the admin session: drops the token and returns the login overlay.
 * Shows one calm notice (not a red error) and only if an admin was actually signed in.
 */
export function expireAdminSession() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  const store = useMapStore.getState();
  if (store.isAdminAuthenticated) {
    store.setIsAdminAuthenticated(false);
    toast('Your admin session ended — please sign in again.', {
      id: 'admin-session-expired',
      icon: '🔒',
      duration: 5000,
    });
  }
}

/**
 * Wraps window.fetch once, so EVERY admin call in the app is covered without touching
 * each call site:
 *  - a 401 on a request that carried the current admin token -> expireAdminSession()
 *  - a renewed token sent back by the server (X-Renewed-Token) -> stored, keeping an
 *    active admin signed in
 * Requests without the admin token (viewer calls, the admin login itself) are ignored.
 */
export function installAdminSessionGuard() {
  if (guardInstalled || typeof window === 'undefined') return;
  guardInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : (input?.url ?? String(input));
      if (url.startsWith(API_BASE_URL) && url.includes('/api/')) {
        const adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
        const sentAuth = new Headers(init?.headers ?? input?.headers).get('authorization');
        // Compare with the CURRENT token so a late 401 from before a re-login is ignored.
        if (adminToken && sentAuth === `Bearer ${adminToken}`) {
          if (response.status === 401) {
            expireAdminSession();
          } else {
            const renewed = response.headers.get(RENEWED_TOKEN_HEADER);
            if (renewed) sessionStorage.setItem(ADMIN_TOKEN_KEY, renewed);
          }
        }
      }
    } catch {
      // The guard must never break a real request.
    }
    return response;
  };
}

/**
 * While an admin is signed in, re-checks the token every few minutes and whenever the
 * tab becomes visible again, so a dead session returns the login screen BEFORE the
 * admin presses Save. Network errors / server downtime never sign anyone out.
 * Returns a cleanup function.
 */
export function startAdminSessionWatch(intervalMs = WATCH_INTERVAL_MS) {
  const check = async () => {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.status === 401 && sessionStorage.getItem(ADMIN_TOKEN_KEY) === token) {
        expireAdminSession();
      }
    } catch {
      // Offline or server restarting: stay signed in and try again next time.
    }
  };

  const timer = setInterval(check, intervalMs);
  const onVisible = () => {
    if (document.visibilityState === 'visible') check();
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
