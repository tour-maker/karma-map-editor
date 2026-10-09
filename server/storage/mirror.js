// One-way copy: MongoDB -> Google Sheet. After the app saves to MongoDB, the changed tabs are
// rewritten in the sheet a few seconds later (several quick edits become one copy). A tab is
// copied whole, so the sheet can never drift out of step; failures are retried and remembered.
// The sheet is a read/download copy — typing in it does not change the app.
import { quoteTitle } from './a1.js';

export function createMirror({
  engine,
  getGoogle,
  spreadsheetId,
  state,
  debounceMs = 4000,
  retryMs = [5000, 20000, 60000, 300000],
  logger = console,
}) {
  let dirty = new Set();
  let timer = null;
  let running = false;
  let attempt = 0;
  let snapshot = { migratedAt: null, lastSyncAt: null, lastError: '' };

  const persist = () => state.save({ dirtyTabs: [...dirty], ...snapshot })
    .catch(e => logger.error('[mirror] could not save state:', e.message));

  async function init() {
    const saved = await state.load();
    dirty = new Set(saved.dirtyTabs || []);
    snapshot = { migratedAt: saved.migratedAt || null, lastSyncAt: saved.lastSyncAt || null, lastError: saved.lastError || '' };
    if (dirty.size) schedule(debounceMs);
  }

  function schedule(delay) {
    if (timer) return;
    timer = setTimeout(() => { timer = null; run(); }, delay);
    timer.unref?.();
  }

  function markDirty(titles) {
    for (const t of titles) dirty.add(t);
    persist();
    schedule(debounceMs);
  }

  async function copyTab(sheets, title) {
    const q = quoteTitle(title);
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
    const exists = (meta.data.sheets || []).some(s => s.properties?.title === title);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
    }
    const got = await engine.spreadsheets.values.get({ range: q });
    const grid = got.data.values || [];
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: q });
    if (grid.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${q}!A1`,
        valueInputOption: 'RAW',
        requestBody: { majorDimension: 'ROWS', values: grid },
      });
    }
    return grid.length;
  }

  async function run() {
    if (running) { schedule(1000); return; }
    if (!dirty.size) return;
    if (!snapshot.migratedAt) {
      // The copy script may have finished after this server started - look again.
      const saved = await state.load().catch(() => ({}));
      if (saved.migratedAt) snapshot = { ...snapshot, migratedAt: saved.migratedAt };
    }
    if (!snapshot.migratedAt) {
      // Never overwrite the sheet before its data has been copied into MongoDB.
      logger.warn('[mirror] skipped: data has not been migrated to MongoDB yet');
      return;
    }
    running = true;
    try {
      const sheets = getGoogle();
      for (const title of [...dirty]) {
        await copyTab(sheets, title);
        dirty.delete(title);
      }
      attempt = 0;
      snapshot = { ...snapshot, lastSyncAt: new Date(), lastError: '' };
    } catch (e) {
      snapshot = { ...snapshot, lastError: String(e?.message || e).slice(0, 500) };
      logger.error('[mirror] copy to Google Sheet failed:', snapshot.lastError);
      schedule(retryMs[Math.min(attempt, retryMs.length - 1)]);
      attempt += 1;
    } finally {
      running = false;
      await persist();
      if (dirty.size && !timer && attempt === 0) schedule(debounceMs);
    }
  }

  // Admin button: rewrite every tab of the sheet from MongoDB right now.
  async function syncAll() {
    if (!snapshot.migratedAt) throw new Error('Data has not been migrated to MongoDB yet');
    const sheets = getGoogle();
    const tabs = await engine.repo.listTabs();
    const counts = {};
    for (const t of tabs) counts[t.title] = await copyTab(sheets, t.title);
    dirty.clear();
    attempt = 0;
    snapshot = { ...snapshot, lastSyncAt: new Date(), lastError: '' };
    await persist();
    return counts;
  }

  function markMigrated() {
    snapshot = { ...snapshot, migratedAt: new Date() };
    return persist();
  }

  const status = () => ({ dirtyTabs: [...dirty], ...snapshot, migrated: !!snapshot.migratedAt });

  return { init, markDirty, run, syncAll, markMigrated, status };
}
