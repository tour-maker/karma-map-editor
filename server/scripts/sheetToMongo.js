// One-time copy: Google Sheet -> MongoDB. Read-only on Google (never edits the sheet).
//   node scripts/sheetToMongo.js --dry-run   only read + show counts
//   node scripts/sheetToMongo.js             copy (refuses if MongoDB already has sheet data)
//   node scripts/sheetToMongo.js --force     wipe the MongoDB copy and copy again
// Then checks every tab matches the sheet cell for cell, and marks the data as migrated.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getGoogleSheets, SPREADSHEET_ID } from '../googleClient.js';
import { createSheetEngine } from '../storage/sheetEngine.js';
import { mongoRepo } from '../storage/mongoRepo.js';
import { quoteTitle } from '../storage/a1.js';
import SheetTab from '../models/SheetTab.js';
import SheetRow from '../models/SheetRow.js';
import SyncState from '../models/SyncState.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

const fail = (msg) => { console.error(`\nSTOP: ${msg}`); process.exit(1); };

if (!process.env.MONGODB_URI) fail('MONGODB_URI is not set');

const sheets = getGoogleSheets();
const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets.properties' });
const tabs = (meta.data.sheets || []).map(s => s.properties).filter(p => p.sheetType === undefined || p.sheetType === 'GRID');

const source = {};
for (const t of tabs) {
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: quoteTitle(t.title) });
  source[t.title] = (r.data.values || []).map(row => row.map(c => String(c ?? '')));
  console.log(`Google Sheet tab "${t.title}": ${source[t.title].length} rows`);
}
if (dryRun) { console.log('\nDry run only - nothing was written.'); process.exit(0); }

await mongoose.connect(process.env.MONGODB_URI);
const existing = await SheetTab.countDocuments();
if (existing && !force) fail('MongoDB already has sheet data. Re-run with --force to wipe it and copy again.');
if (existing) { await SheetRow.deleteMany({}); await SheetTab.deleteMany({}); }

const trim = (cells) => { const c = cells.slice(); while (c.length && c[c.length - 1] === '') c.pop(); return c; };
for (const t of tabs) {
  await mongoRepo.addTab({ sheetId: t.sheetId, title: t.title, index: t.index ?? 0 });
  const upserts = [];
  source[t.title].forEach((cells, i) => { const c = trim(cells); if (c.length) upserts.push({ row: i + 1, cells: c }); });
  for (let i = 0; i < upserts.length; i += 500) await mongoRepo.upsertRows(t.sheetId, upserts.slice(i, i + 500));
}

// Read everything back through the same engine the app uses and compare with the sheet.
const engine = createSheetEngine({ repo: mongoRepo });
let bad = 0;
for (const t of tabs) {
  const back = (await engine.spreadsheets.values.get({ range: quoteTitle(t.title) })).data.values || [];
  const want = source[t.title].map(trim);
  while (want.length && !want[want.length - 1].length) want.pop();
  const same = JSON.stringify(back) === JSON.stringify(want);
  console.log(`MongoDB tab "${t.title}": ${back.length} rows -> ${same ? 'MATCHES the sheet' : 'DIFFERENT!'}`);
  if (!same) bad++;
}
if (bad) fail(`${bad} tab(s) did not match. Do NOT switch to STORAGE=mongo.`);

await SyncState.updateOne({ key: 'mirror' }, { $set: { migratedAt: new Date(), dirtyTabs: [], lastError: '' } }, { upsert: true });
console.log('\nDONE: every tab matches. You can now set STORAGE=mongo and restart the backend.');
await mongoose.disconnect();
