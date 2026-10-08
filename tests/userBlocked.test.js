import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('installUserBlockedGuard', () => {
  beforeEach(() => { vi.resetModules(); });

  it('signs the viewer out and fires the notice on a 403 USER_BLOCKED from our API', async () => {
    const store = {};
    globalThis.localStorage = { removeItem: k => { delete store[k]; }, getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
    store.karmaUserJWT = 'tok';
    const events = [];
    globalThis.window = {
      fetch: async () => new Response(JSON.stringify({ code: 'USER_BLOCKED' }), { status: 403 }),
      dispatchEvent: e => events.push(e.type),
    };
    globalThis.CustomEvent = class { constructor(t) { this.type = t; } };
    const { installUserBlockedGuard } = await import('../src/utils/userBlocked.js');
    const { API_BASE_URL } = await import('../src/config/api.js');
    installUserBlockedGuard();
    const res = await window.fetch(`${API_BASE_URL}/api/submissions`);
    expect(res.status).toBe(403);
    expect(events).toEqual(['karma-user-blocked']);
    expect(store.karmaUserJWT).toBeUndefined();
  });
});
