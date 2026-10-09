// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { parseA1 } from '../server/storage/a1.js';
import { createSheetEngine } from '../server/storage/sheetEngine.js';
import { createMemoryRepo } from '../server/storage/memoryRepo.js';
import { createMirror } from '../server/storage/mirror.js';

describe('parseA1', () => {
  it('reads the range forms the app sends', () => {
    expect(parseA1('Polygons')).toMatchObject({ title: 'Polygons', startCol: 0, endCol: null, startRow: 1, endRow: null });
    expect(parseA1('Polygons!A:S')).toMatchObject({ startCol: 0, endCol: 18, startRow: 1, endRow: null });
    expect(parseA1('Polygons!A5:S5')).toMatchObject({ startCol: 0, endCol: 18, startRow: 5, endRow: 5 });
    expect(parseA1('Polygons!S1')).toMatchObject({ startCol: 18, endCol: 18, startRow: 1, endRow: 1 });
    expect(parseA1('Polygons!H2:H100')).toMatchObject({ startCol: 7, endCol: 7, startRow: 2, endRow: 100 });
    expect(parseA1("'My Tab'!A1:C3").title).toBe('My Tab');
  });
});

async function setup() {
  const writes = [];
  const engine = createSheetEngine({ repo: createMemoryRepo(), onWrite: t => writes.push(...t) });
  await engine.spreadsheets.batchUpdate({ requestBody: { requests: [{ addSheet: { properties: { title: 'Polygons', sheetId: 11 } } }, { addSheet: { properties: { title: 'Areas', sheetId: 22 } } }] } });
  return { engine, writes, v: engine.spreadsheets.values };
}
const read = async (v, range) => (await v.get({ range })).data.values;

describe('sheet engine', () => {
  let ctx;
  beforeEach(async () => { ctx = await setup(); });

  it('overwrites a tab and reads it back, trimming empty trailing cells and rows', async () => {
    const { v } = ctx;
    await v.update({ range: 'Polygons', requestBody: { values: [['id', 'tp', ''], ['s1', '', 'x'], ['s2', '5', '']] } });
    expect(await read(v, 'Polygons')).toEqual([['id', 'tp'], ['s1', '', 'x'], ['s2', '5']]);
    expect(await read(v, 'Areas')).toBeUndefined();
  });

  it('slices columns and rows for ranges', async () => {
    const { v } = ctx;
    await v.update({ range: 'Polygons', requestBody: { values: [['id', 'tp', 'op'], ['s1', 'a', 'b'], ['s2', 'c', 'd']] } });
    expect(await read(v, 'Polygons!A:A')).toEqual([['id'], ['s1'], ['s2']]);
    expect(await read(v, 'Polygons!B2:C2')).toEqual([['a', 'b']]);
    expect(await read(v, 'Polygons!A3')).toEqual([[], [], ['s2']].slice(2));
    expect(await read(v, 'Polygons!A2:A9')).toEqual([['s1'], ['s2']]);
  });

  it('edits one row and one cell without touching the rest', async () => {
    const { v } = ctx;
    await v.update({ range: 'Polygons', requestBody: { values: [['id', 'tp', 'op'], ['s1', 'a', 'b'], ['s2', 'c', 'd']] } });
    await v.update({ range: 'Polygons!A3:C3', requestBody: { values: [['s2', 'C', 'D']] } });
    await v.update({ range: 'Polygons!C2', requestBody: { values: [['B']] } });
    expect(await read(v, 'Polygons')).toEqual([['id', 'tp', 'op'], ['s1', 'a', 'B'], ['s2', 'C', 'D']]);
  });

  it('appends after the last row and keeps leading blank columns', async () => {
    const { v } = ctx;
    await v.update({ range: 'Polygons', requestBody: { values: [['id', 'tp'], ['s1', 'a']] } });
    await v.append({ range: 'Polygons!A:S', requestBody: { values: [['s2', 'b'], ['s3', 'c']] } });
    expect(await read(v, 'Polygons!A:A')).toEqual([['id'], ['s1'], ['s2'], ['s3']]);
    await v.append({ range: 'Areas', requestBody: { values: [['Surat', 'Vesu']] } });
    expect(await read(v, 'Areas')).toEqual([['Surat', 'Vesu']]);
  });

  it('deletes a row and shifts the rows below up (like a sheet)', async () => {
    const { v, engine } = ctx;
    await v.update({ range: 'Polygons', requestBody: { values: [['id'], ['s1'], ['s2'], ['s3']] } });
    await engine.spreadsheets.batchUpdate({ requestBody: { requests: [{ deleteDimension: { range: { sheetId: 11, dimension: 'ROWS', startIndex: 1, endIndex: 2 } } }] } });
    expect(await read(v, 'Polygons')).toEqual([['id'], ['s2'], ['s3']]);
  });

  it('deletes several rows bottom-up in one batch', async () => {
    const { v, engine } = ctx;
    await v.update({ range: 'Areas', requestBody: { values: [['p', 's'], ['A', '1'], ['B', '2'], ['C', '3'], ['D', '4']] } });
    await engine.spreadsheets.batchUpdate({ requestBody: { requests: [
      { deleteDimension: { range: { sheetId: 22, dimension: 'ROWS', startIndex: 3, endIndex: 4 } } },
      { deleteDimension: { range: { sheetId: 22, dimension: 'ROWS', startIndex: 1, endIndex: 2 } } },
    ] } });
    expect(await read(v, 'Areas')).toEqual([['p', 's'], ['B', '2'], ['D', '4']]);
  });

  it('clears a whole tab, or just some columns', async () => {
    const { v } = ctx;
    await v.update({ range: 'Polygons', requestBody: { values: [['id', 'tp'], ['s1', 'a']] } });
    await v.clear({ range: 'Polygons!B1:B9' });
    expect(await read(v, 'Polygons')).toEqual([['id'], ['s1']]);
    await v.clear({ range: 'Polygons' });
    expect(await read(v, 'Polygons')).toBeUndefined();
  });

  it('keeps blank cells in the middle and ignores null (leave unchanged)', async () => {
    const { v } = ctx;
    await v.update({ range: 'Polygons', requestBody: { values: [['a', 'b', 'c']] } });
    await v.update({ range: 'Polygons!A1', requestBody: { values: [[null, '', 'C']] } });
    expect(await read(v, 'Polygons')).toEqual([['a', '', 'C']]);
  });

  it('lists tabs, adds a tab, rejects a duplicate, and reports which tab changed', async () => {
    const { engine, writes } = ctx;
    const meta = await engine.spreadsheets.get({});
    expect(meta.data.sheets.map(s => s.properties.title)).toEqual(['Polygons', 'Areas']);
    const r = await engine.spreadsheets.batchUpdate({ requestBody: { requests: [{ addSheet: { properties: { title: 'Landmarks' } } }] } });
    expect(r.data.replies[0].addSheet.properties.title).toBe('Landmarks');
    await expect(engine.spreadsheets.batchUpdate({ requestBody: { requests: [{ addSheet: { properties: { title: 'Landmarks' } } }] } })).rejects.toThrow(/already exists/);
    expect(writes).toContain('Landmarks');
  });

  it('errors on an unknown tab like the sheet does', async () => {
    await expect(ctx.v.get({ range: 'Nope!A:A' })).rejects.toThrow();
  });

  it('keeps data exact: long JSON text, numbers and booleans become text', async () => {
    const { v } = ctx;
    const json = JSON.stringify([{ lat: 21.17, lng: 72.83 }]);
    await v.update({ range: 'Polygons', requestBody: { values: [[json, 12, true]] } });
    expect(await read(v, 'Polygons')).toEqual([[json, '12', 'TRUE']]);
  });
});

describe('mirror to Google Sheet', () => {
  function fakeGoogle() {
    const calls = [];
    const tabs = [];
    return {
      calls,
      spreadsheets: {
        get: async () => ({ data: { sheets: tabs.map(title => ({ properties: { title } })) } }),
        batchUpdate: async ({ requestBody }) => { for (const r of requestBody.requests) { tabs.push(r.addSheet.properties.title); calls.push(['addSheet', r.addSheet.properties.title]); } return {}; },
        values: {
          clear: async ({ range }) => { calls.push(['clear', range]); },
          update: async ({ range, requestBody, valueInputOption }) => { calls.push(['update', range, requestBody.values, valueInputOption]); },
        },
      },
    };
  }
  const memState = () => { let s = {}; return { load: async () => s, save: async (x) => { s = { ...x }; } }; };

  async function build({ migrated = true, google = fakeGoogle() } = {}) {
    const { engine } = await setup();
    const state = memState();
    const mirror = createMirror({ engine, getGoogle: () => google, spreadsheetId: 'x', state, debounceMs: 5, retryMs: [5], logger: { error() {}, warn() {} } });
    await mirror.init();
    if (migrated) await mirror.markMigrated();
    return { engine, mirror, google };
  }

  it('copies a changed tab to the sheet (clear then write) and clears the dirty flag', async () => {
    const { engine, mirror, google } = await build();
    await engine.spreadsheets.values.update({ range: 'Polygons', requestBody: { values: [['id'], ['s1']] } });
    mirror.markDirty(['Polygons']);
    await mirror.run();
    expect(google.calls.map(c => c[0])).toEqual(['addSheet', 'clear', 'update']);
    expect(google.calls[2][2]).toEqual([['id'], ['s1']]);
    expect(google.calls[2][3]).toBe('RAW');
    expect(mirror.status().dirtyTabs).toEqual([]);
    expect(mirror.status().lastSyncAt).toBeTruthy();
  });

  it('never touches the sheet before the data has been migrated', async () => {
    const { mirror, google } = await build({ migrated: false });
    mirror.markDirty(['Polygons']);
    await mirror.run();
    expect(google.calls).toEqual([]);
    expect(mirror.status().dirtyTabs).toEqual(['Polygons']);
  });

  it('keeps the tab marked dirty when Google fails, then succeeds on retry', async () => {
    const google = fakeGoogle();
    let fail = true;
    const realClear = google.spreadsheets.values.clear;
    google.spreadsheets.values.clear = async (a) => { if (fail) throw new Error('quota'); return realClear(a); };
    const { engine, mirror } = await build({ google });
    await engine.spreadsheets.values.update({ range: 'Polygons', requestBody: { values: [['id']] } });
    mirror.markDirty(['Polygons']);
    await mirror.run();
    expect(mirror.status().dirtyTabs).toEqual(['Polygons']);
    expect(mirror.status().lastError).toMatch(/quota/);
    fail = false;
    await mirror.run();
    expect(mirror.status().dirtyTabs).toEqual([]);
    expect(mirror.status().lastError).toBe('');
  });

  it('syncAll rewrites every tab', async () => {
    const { engine, mirror, google } = await build();
    await engine.spreadsheets.values.update({ range: 'Polygons', requestBody: { values: [['id'], ['s1']] } });
    const counts = await mirror.syncAll();
    expect(counts).toEqual({ Polygons: 2, Areas: 0 });
    expect(google.calls.filter(c => c[0] === 'update').length).toBe(1);
  });
});

describe('mirror picks up a migration finished after the server started', () => {
  it('re-reads the saved state before refusing', async () => {
    const { engine } = await setup();
    let saved = {};
    const state = { load: async () => saved, save: async () => {} };
    const calls = [];
    const google = { spreadsheets: { get: async () => ({ data: { sheets: [{ properties: { title: 'Polygons' } }] } }), values: { clear: async () => calls.push('clear'), update: async () => calls.push('update') } } };
    const mirror = createMirror({ engine, getGoogle: () => google, spreadsheetId: 'x', state, debounceMs: 5, logger: { error() {}, warn() {} } });
    await mirror.init();
    mirror.markDirty(['Polygons']);
    await mirror.run();
    expect(calls).toEqual([]);
    saved = { migratedAt: new Date() };
    await mirror.run();
    expect(calls).toContain('clear');
  });
});
