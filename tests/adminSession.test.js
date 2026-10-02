import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('react-hot-toast', () => ({ default: vi.fn() }));

const API = 'http://localhost:5050';

function jsonResponse(status, headers = {}) {
  return new Response(JSON.stringify({}), { status, headers });
}

describe('admin session guard', () => {
  let useMapStore, toast, mod, realFetch, fakeFetch;

  beforeEach(async () => {
    vi.resetModules();
    sessionStorage.clear();
    realFetch = window.fetch;
    fakeFetch = vi.fn();
    window.fetch = fakeFetch;
    ({ useMapStore } = await import('../src/store/useMapStore'));
    toast = (await import('react-hot-toast')).default;
    toast.mockClear();
    mod = await import('../src/utils/adminSession');
    mod.installAdminSessionGuard();
    sessionStorage.setItem('karmaAdminJWT', 'tok1');
    useMapStore.getState().setIsAdminAuthenticated(true);
  });

  afterEach(() => {
    window.fetch = realFetch;
    vi.useRealTimers();
  });

  it('signs the admin out with one calm notice when an admin request gets 401', async () => {
    fakeFetch.mockResolvedValue(jsonResponse(401));
    await window.fetch(`${API}/api/sheets/values`, { method: 'PUT', headers: { Authorization: 'Bearer tok1' } });
    expect(sessionStorage.getItem('karmaAdminJWT')).toBeNull();
    expect(useMapStore.getState().isAdminAuthenticated).toBe(false);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('ignores 401s that did not carry the admin token (viewer calls, admin login)', async () => {
    fakeFetch.mockResolvedValue(jsonResponse(401));
    await window.fetch(`${API}/api/auth/login`, { method: 'POST' });
    await window.fetch(`${API}/api/submissions/mine`, { headers: { Authorization: 'Bearer viewer-token' } });
    expect(sessionStorage.getItem('karmaAdminJWT')).toBe('tok1');
    expect(useMapStore.getState().isAdminAuthenticated).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });

  it('ignores a late 401 for an old token after the admin signed in again', async () => {
    fakeFetch.mockImplementation(async () => {
      sessionStorage.setItem('karmaAdminJWT', 'tok2'); // re-login happens while request is in flight
      return jsonResponse(401);
    });
    await window.fetch(`${API}/api/sheets/values`, { method: 'PUT', headers: { Authorization: 'Bearer tok1' } });
    expect(sessionStorage.getItem('karmaAdminJWT')).toBe('tok2');
    expect(useMapStore.getState().isAdminAuthenticated).toBe(true);
  });

  it('stores a renewed token sent back by the server', async () => {
    fakeFetch.mockResolvedValue(jsonResponse(200, { 'X-Renewed-Token': 'tok-new' }));
    await window.fetch(`${API}/api/submissions`, { headers: { Authorization: 'Bearer tok1' } });
    expect(sessionStorage.getItem('karmaAdminJWT')).toBe('tok-new');
  });

  it('does not touch non-API requests', async () => {
    fakeFetch.mockResolvedValue(jsonResponse(401));
    await window.fetch('https://example.com/other', { headers: { Authorization: 'Bearer tok1' } });
    expect(sessionStorage.getItem('karmaAdminJWT')).toBe('tok1');
  });

  it('background check signs out on 401 but not on network errors or 5xx', async () => {
    vi.useFakeTimers();
    const stop = mod.startAdminSessionWatch(1000);

    fakeFetch.mockRejectedValueOnce(new TypeError('network down'));
    await vi.advanceTimersByTimeAsync(1000);
    fakeFetch.mockResolvedValueOnce(jsonResponse(502));
    await vi.advanceTimersByTimeAsync(1000);
    expect(useMapStore.getState().isAdminAuthenticated).toBe(true);

    fakeFetch.mockResolvedValueOnce(jsonResponse(401));
    await vi.advanceTimersByTimeAsync(1000);
    expect(useMapStore.getState().isAdminAuthenticated).toBe(false);
    expect(sessionStorage.getItem('karmaAdminJWT')).toBeNull();
    stop();
  });
});
