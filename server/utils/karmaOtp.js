// OTP check for sign up, done by the Karma Group OTP service.
//   send   -> asks Karma to text a code to the mobile number
//   verify -> asks Karma whether the code the user typed is right
// The service address and paths come from settings, so moving from the test address to the
// final one is a settings change only:
//   OTP_ENABLED=true            switch the real check on (off = same behaviour as before)
//   KARMA_OTP_BASE_URL=https://...        e.g. the ngrok test address, later the final one
//   KARMA_OTP_SEND_PATH=/api/v1/auth/register-property     (default shown)
//   KARMA_OTP_VERIFY_PATH=/api/v1/auth/login-otp           (default shown)
//   OTP_LENGTH=4                number of digits in the code (default 4)
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './adminJwt.js';

const env = () => process.env;

export const otpEnabled = () => String(env().OTP_ENABLED || '').toLowerCase() === 'true' && !!env().KARMA_OTP_BASE_URL;
export const otpLength = () => {
  const n = Number(env().OTP_LENGTH);
  return Number.isInteger(n) && n >= 3 && n <= 8 ? n : 4;
};

// Mobile numbers are compared as the last 10 digits (so +91 and spaces do not matter).
export const normalizeMobile = (value) => String(value || '').replace(/\D/g, '').slice(-10);

const joinUrl = (base, path) => `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;

async function callKarma(path, payload) {
  const url = joinUrl(env().KARMA_OTP_BASE_URL, path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Lets requests through the free ngrok test tunnel without its browser warning page.
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    return { httpOk: res.ok, status: res.status, body, text };
  } finally {
    clearTimeout(timer);
  }
}

// The Karma documentation shows no sample response, so accept the usual shapes:
// HTTP 2xx and the body does not say status/success is false.
function interpret(result) {
  const b = result.body;
  const flagFalse = b && (b.status === false || b.success === false || String(b.status).toLowerCase() === 'false' || String(b.status).toLowerCase() === 'fail' || String(b.status).toLowerCase() === 'error');
  const message = b && (b.message || b.msg || b.error || (typeof b.data === 'string' ? b.data : '')) || '';
  return { ok: result.httpOk && !flagFalse, message: typeof message === 'string' ? message : '' };
}

export async function sendKarmaOtp(mobile) {
  const r = await callKarma(env().KARMA_OTP_SEND_PATH || '/api/v1/auth/register-property', { mobile });
  return { ...interpret(r), status: r.status };
}

export async function verifyKarmaOtp(mobile, otp) {
  const r = await callKarma(env().KARMA_OTP_VERIFY_PATH || '/api/v1/auth/login-otp', { mobile, otp });
  return { ...interpret(r), status: r.status };
}

// Proof that this mobile number passed the OTP check. Sign up asks for it.
export const issueOtpProof = (mobile) => jwt.sign({ purpose: 'otp-verified', mobile }, JWT_SECRET, { expiresIn: '15m' });
export function checkOtpProof(token, mobile) {
  try {
    const d = jwt.verify(String(token || ''), JWT_SECRET);
    return d.purpose === 'otp-verified' && d.mobile === normalizeMobile(mobile);
  } catch {
    return false;
  }
}

// Small in-memory limiter: each text message can cost money and could be abused.
const hits = new Map();
export function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (list.length >= max) { hits.set(key, list); return true; }
  list.push(now); hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
  return false;
}
export const _resetRateLimits = () => hits.clear();
