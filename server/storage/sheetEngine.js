// A tiny spreadsheet engine that mimics the parts of the Google Sheets API this app uses
// (values.get / update / append / clear, spreadsheets.get, spreadsheets.batchUpdate), so the
// existing routes and helpers work unchanged when the data lives in MongoDB instead.
//
// Storage is injected (see mongoRepo.js / memoryRepo.js). Rows are positional, exactly like a
// sheet: row 5 is row 5, and deleting a row shifts later rows up by one.
import { parseA1 } from './a1.js';

function norm(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

function trimRight(cells) {
  const out = cells.slice();
  while (out.length && (out[out.length - 1] === '' || out[out.length - 1] === undefined || out[out.length - 1] === null)) out.pop();
  return out;
}

export function createSheetEngine({ repo, onWrite = () => {} }) {
  // Everything is serialised: row shifts and read-modify-write steps must never interleave.
  let chain = Promise.resolve();
  const locked = (fn) => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };

  const requireTab = async (title) => {
    const tab = await repo.tabByTitle(title);
    if (!tab) throw new Error(`Unable to parse range: ${title}`);
    return tab;
  };

  const writeCells = async (tab, range, values) => {
    const rowsIn = values.map(r => (Array.isArray(r) ? r : [r]));
    if (!rowsIn.length) return;
    const first = range.startRow;
    const existing = await repo.rowsInRange(tab.sheetId, first, first + rowsIn.length - 1);
    const byRow = new Map(existing.map(r => [r.row, r.cells]));
    const upserts = [];
    const removals = [];
    rowsIn.forEach((vals, i) => {
      const row = first + i;
      const cells = (byRow.get(row) || []).slice();
      vals.forEach((raw, j) => {
        const v = norm(raw);
        if (v === null) return; // null = leave the cell as it is
        const col = range.startCol + j;
        while (cells.length < col) cells.push('');
        cells[col] = v;
      });
      const trimmed = trimRight(cells).map(c => c ?? '');
      if (trimmed.length) upserts.push({ row, cells: trimmed });
      else removals.push(row);
    });
    if (removals.length) await repo.clearRows(tab.sheetId, removals);
    if (upserts.length) await repo.upsertRows(tab.sheetId, upserts);
  };

  const values = {
    get: ({ range }) => locked(async () => {
      const r = parseA1(range);
      const tab = await requireTab(r.title);
      const stored = await repo.rowsInRange(tab.sheetId, r.startRow, r.endRow);
      const byRow = new Map(stored.map(x => [x.row, x.cells]));
      const out = [];
      let last = 0;
      const lastStored = stored.length ? stored[stored.length - 1].row : 0;
      const to = r.endRow === null ? lastStored : Math.min(r.endRow, lastStored);
      for (let row = r.startRow; row <= to; row++) {
        const cells = byRow.get(row) || [];
        const slice = trimRight(cells.slice(r.startCol, r.endCol === null ? undefined : r.endCol + 1));
        out.push(slice);
        if (slice.length) last = out.length;
      }
      out.length = last;
      return { data: { range, majorDimension: 'ROWS', values: out.length ? out : undefined } };
    }),

    update: ({ range, requestBody }) => locked(async () => {
      const r = parseA1(range);
      const tab = await requireTab(r.title);
      await writeCells(tab, r, requestBody?.values || []);
      onWrite([tab.title]);
      return { data: { updatedRange: range } };
    }),

    append: ({ range, requestBody }) => locked(async () => {
      const r = parseA1(range);
      const tab = await requireTab(r.title);
      const last = await repo.lastRow(tab.sheetId);
      await writeCells(tab, { ...r, startRow: last + 1 }, requestBody?.values || []);
      onWrite([tab.title]);
      return { data: { updates: { updatedRange: range } } };
    }),

    clear: ({ range }) => locked(async () => {
      const r = parseA1(range);
      const tab = await requireTab(r.title);
      if (r.startCol === 0 && r.endCol === null) {
        await repo.deleteRowsInRange(tab.sheetId, r.startRow, r.endRow);
      } else {
        const stored = await repo.rowsInRange(tab.sheetId, r.startRow, r.endRow);
        const upserts = [];
        const removals = [];
        for (const { row, cells } of stored) {
          const next = cells.slice();
          const end = r.endCol === null ? next.length - 1 : Math.min(r.endCol, next.length - 1);
          for (let c = r.startCol; c <= end; c++) next[c] = '';
          const trimmed = trimRight(next);
          if (trimmed.length) upserts.push({ row, cells: trimmed }); else removals.push(row);
        }
        if (removals.length) await repo.clearRows(tab.sheetId, removals);
        if (upserts.length) await repo.upsertRows(tab.sheetId, upserts);
      }
      onWrite([tab.title]);
      return { data: { clearedRange: range } };
    }),
  };

  const spreadsheets = {
    values,

    get: () => locked(async () => {
      const tabs = await repo.listTabs();
      return {
        data: {
          sheets: tabs.map(t => ({ properties: { sheetId: t.sheetId, title: t.title, index: t.index, sheetType: 'GRID' } })),
        },
      };
    }),

    batchUpdate: ({ requestBody }) => locked(async () => {
      const replies = [];
      const touched = new Set();
      for (const req of requestBody?.requests || []) {
        if (req.deleteDimension) {
          const { range } = req.deleteDimension;
          if (range.dimension !== 'ROWS') throw new Error('Only row deletion is supported');
          const tabs = await repo.listTabs();
          const tab = tabs.find(t => t.sheetId === range.sheetId);
          if (!tab) throw new Error(`No grid with id: ${range.sheetId}`);
          // Delete bottom-up so earlier indexes stay valid, like a sheet does.
          for (let i = range.endIndex - 1; i >= range.startIndex; i--) await repo.deleteRowShift(tab.sheetId, i + 1);
          touched.add(tab.title);
          replies.push({});
        } else if (req.addSheet) {
          const title = req.addSheet.properties?.title;
          if (!title) throw new Error('addSheet needs a title');
          const tabs = await repo.listTabs();
          if (tabs.some(t => t.title === title)) {
            throw new Error(`A sheet with the name "${title}" already exists. Please enter another name.`);
          }
          let sheetId = req.addSheet.properties?.sheetId;
          if (sheetId === undefined || tabs.some(t => t.sheetId === sheetId)) {
            do { sheetId = Math.floor(Math.random() * 2000000000) + 1; } while (tabs.some(t => t.sheetId === sheetId));
          }
          const tab = { sheetId, title, index: tabs.length };
          await repo.addTab(tab);
          touched.add(title);
          replies.push({ addSheet: { properties: { ...tab, sheetType: 'GRID' } } });
        } else {
          throw new Error(`Unsupported batchUpdate request: ${Object.keys(req).join(',')}`);
        }
      }
      if (touched.size) onWrite([...touched]);
      return { data: { replies } };
    }),
  };

  return { spreadsheets, repo };
}
