import { google } from 'googleapis';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Imported by route modules before server.js reaches its dotenv.config() call, so load the
// server-local env file here first (otherwise server/.env deployments fall back to defaults).
dotenv.config({ path: join(__dirname, '.env') });

export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1-9eVBefBNnBJMp4iQBlnA4wdHmEiinHERilgu-b7GQ4';

// Service-account credentials, loaded lazily so a server that keeps its data in MongoDB can
// start (and run) without any Google credentials. Either:
//  - GOOGLE_SERVICE_ACCOUNT_JSON env var (raw JSON, or base64 of it) — for hosts like Render, or
//  - server/service-account.json — the VPS way.
let credentials = null;
function loadCredentials() {
  if (credentials) return credentials;
  const env = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (env && env.trim()) {
    const raw = env.trim().startsWith('{') ? env.trim() : Buffer.from(env.trim(), 'base64').toString('utf8');
    credentials = JSON.parse(raw);
    return credentials;
  }
  const file = join(__dirname, 'service-account.json');
  if (existsSync(file)) {
    credentials = JSON.parse(readFileSync(file, 'utf8'));
    return credentials;
  }
  throw new Error('Google credentials not configured (set GOOGLE_SERVICE_ACCOUNT_JSON or add server/service-account.json)');
}

export const hasGoogleCredentials = () => {
  try { loadCredentials(); return true; } catch { return false; }
};

// The real Google Sheets client.
export const getGoogleSheets = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: loadCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};
