// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import express from '../server/node_modules/express/index.js';

// A stand-in for the Karma Group OTP service.
let karma, karmaUrl, seen, mode;
const startKarma = () => new Promise(resolve => {
  karma = http.createServer((req, res) => {
    let raw = ''; req.on('data', c => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      seen.push({ url: req.url, headers: req.headers, body });
      res.setHeader('Content-Type', 'application/json');
      if (mode === 'down') { res.statusCode = 500; return res.end('oops'); }
      if (req.url === '/api/v1/auth/register-property') return res.end(JSON.stringify({ status: true, message: 'OTP sent' }));
      if (req.url === '/api/v1/auth/login-otp') {
        if (body.otp === '3387') return res.end(JSON.stringify({ status: true, data: { token: 'x' } }));
        res.statusCode = 400; return res.end(JSON.stringify({ status: false, message: 'Invalid OTP' }));
      }
      res.statusCode = 404; res.end('{}');
    });
  }).listen(0, () => { karmaUrl = `http://127.0.0.1:${karma.address().port}`; resolve(); });
});

let app, base, authRouter, utils;
async function boot() {
  authRouter = (await import('../server/routes/auth.js')).default;
  utils = await import('../server/utils/karmaOtp.js');
  const a = express(); a.use(express.json()); a.set('trust proxy', 1); a.use('/api/auth', authRouter);
  await new Promise(r => { app = a.listen(0, () => { base = `http://127.0.0.1:${app.address().port}`; r(); }); });
}
const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, data: await r.json() }));

beforeAll(async () => { seen = []; mode = 'ok'; await startKarma(); await boot(); });
afterAll(() => { karma?.close(); app?.close(); });
beforeEach(() => { seen = []; mode = 'ok'; utils._resetRateLimits(); delete process.env.OTP_ENABLED; delete process.env.KARMA_OTP_BASE_URL; delete process.env.OTP_LENGTH; });

const enable = () => { process.env.OTP_ENABLED = 'true'; process.env.KARMA_OTP_BASE_URL = karmaUrl; };

describe('OTP switched off (default)', () => {
  it('keeps today\'s behaviour: nothing is sent, sign up needs no proof', async () => {
    expect((await post('/api/auth/otp/send', { mobile: '9602650160' })).data).toMatchObject({ success: true, simulated: true });
    const v = await post('/api/auth/otp/verify', { mobile: '9602650160', otp: '1234' });
    expect(v.data.success).toBe(true);
    expect(seen.length).toBe(0);
    const cfg = await (await fetch(base + '/api/auth/otp/config')).json();
    expect(cfg).toEqual({ enabled: false, length: 4 });
  });
});

describe('OTP switched on', () => {
  it('sends the OTP through the Karma service with the right address and payload', async () => {
    enable();
    const r = await post('/api/auth/otp/send', { mobile: '+91 96026 50160' });
    expect(r.data.success).toBe(true);
    expect(seen[0].url).toBe('/api/v1/auth/register-property');
    expect(seen[0].body).toEqual({ mobile: '9602650160' });
    expect(seen[0].headers['ngrok-skip-browser-warning']).toBe('true');
  });

  it('accepts the right code and returns a proof, rejects a wrong code', async () => {
    enable();
    const ok = await post('/api/auth/otp/verify', { mobile: '9602650160', otp: '3387' });
    expect(ok.data.success).toBe(true);
    expect(utils.checkOtpProof(ok.data.otpToken, '9602650160')).toBe(true);
    expect(utils.checkOtpProof(ok.data.otpToken, '9999999999')).toBe(false);
    const bad = await post('/api/auth/otp/verify', { mobile: '9602650160', otp: '0000' });
    expect(bad.status).toBe(400);
    expect(bad.data).toMatchObject({ success: false, error: 'Invalid OTP' });
  });

  it('refuses sign up without the proof', async () => {
    enable();
    const r = await post('/api/auth/signup', { mobile: '9602650160', password: 'secret1' });
    expect(r.status).toBe(400);
    expect(r.data.code).toBe('OTP_REQUIRED');
    const forged = await post('/api/auth/signup', { mobile: '9602650160', password: 'secret1', otpToken: 'abc' });
    expect(forged.data.code).toBe('OTP_REQUIRED');
  });

  it('reports a friendly error when the Karma service is down or unreachable', async () => {
    enable(); mode = 'down';
    const down = await post('/api/auth/otp/send', { mobile: '9602650160' });
    expect(down.status).toBe(502);
    process.env.KARMA_OTP_BASE_URL = 'http://127.0.0.1:9';
    const unreachable = await post('/api/auth/otp/send', { mobile: '9602650161' });
    expect(unreachable.status).toBe(502);
    expect(unreachable.data.error).toMatch(/not reachable/i);
  });

  it('limits how often one number can ask for an OTP', async () => {
    enable();
    for (let i = 0; i < 5; i++) expect((await post('/api/auth/otp/send', { mobile: '9602650160' })).status).toBe(200);
    expect((await post('/api/auth/otp/send', { mobile: '9602650160' })).status).toBe(429);
  });

  it('rejects bad numbers and wrong-length codes, and honours OTP_LENGTH', async () => {
    enable();
    expect((await post('/api/auth/otp/send', { mobile: '123' })).status).toBe(400);
    expect((await post('/api/auth/otp/verify', { mobile: '9602650160', otp: '12' })).status).toBe(400);
    process.env.OTP_LENGTH = '6';
    expect((await (await fetch(base + '/api/auth/otp/config')).json()).length).toBe(6);
    expect((await post('/api/auth/otp/verify', { mobile: '9602650160', otp: '3387' })).status).toBe(400);
  });
});
