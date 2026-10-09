import { createSheetEngine } from './sheetEngine.js';
import { createMirror } from './mirror.js';
import { mongoRepo } from './mongoRepo.js';
import { createMemoryRepo } from './memoryRepo.js';
import SyncState from '../models/SyncState.js';
import { getGoogleSheets, hasGoogleCredentials, SPREADSHEET_ID } from '../googleClient.js';

// STORAGE=mongo -> MongoDB is the database (sheet becomes a copy). Anything else -> Google Sheet as today.
export const isMongoStorage = () => String(process.env.STORAGE || 'sheets').toLowerCase() === 'mongo';

const stateStore = {
  async load() {
    const d = await SyncState.findOne({ key: 'mirror' }).lean();
    return d || {};
  },
  async save({ dirtyTabs, migratedAt, lastSyncAt, lastError }) {
    await SyncState.updateOne(
      { key: 'mirror' },
      { $set: { dirtyTabs, migratedAt, lastSyncAt, lastError } },
      { upsert: true },
    );
  },
};

let singleton = null;

export function getStorage() {
  if (singleton) return singleton;
  let mirror = null;
  const engine = createSheetEngine({
    // STORAGE_TEST_MEMORY=1 is for local tests only (no database needed).
    repo: process.env.STORAGE_TEST_MEMORY === '1' ? createMemoryRepo() : mongoRepo,
    onWrite: (titles) => { if (mirror && mirrorEnabled()) mirror.markDirty(titles); },
  });
  mirror = createMirror({ engine, getGoogle: getGoogleSheets, spreadsheetId: SPREADSHEET_ID, state: stateStore });
  singleton = { engine, mirror };
  return singleton;
}

// The copy to Google only runs when credentials exist and SHEETS_MIRROR is not "off".
export const mirrorEnabled = () =>
  String(process.env.SHEETS_MIRROR || 'on').toLowerCase() !== 'off' && hasGoogleCredentials();

export async function initStorage() {
  if (!isMongoStorage()) return;
  const { mirror } = getStorage();
  await mirror.init();
  console.log(`[storage] MongoDB is the database; Google Sheet copy ${mirrorEnabled() ? 'ON' : 'OFF'}`);
}
