// In-memory storage with the same contract as mongoRepo.js — used by the tests.
export function createMemoryRepo() {
  const tabs = [];
  const rows = new Map(); // sheetId -> Map(row -> cells)
  const grid = (id) => { if (!rows.has(id)) rows.set(id, new Map()); return rows.get(id); };
  return {
    async listTabs() { return tabs.map(t => ({ ...t })).sort((a, b) => a.index - b.index); },
    async tabByTitle(title) { const t = tabs.find(x => x.title === title); return t ? { ...t } : null; },
    async addTab(tab) { tabs.push({ ...tab }); },
    async rowsInRange(id, from, to) {
      return [...grid(id).entries()]
        .filter(([r]) => r >= from && (to === null || r <= to))
        .sort((a, b) => a[0] - b[0])
        .map(([row, cells]) => ({ row, cells: cells.slice() }));
    },
    async lastRow(id) { return Math.max(0, ...grid(id).keys()); },
    async upsertRows(id, list) { for (const { row, cells } of list) grid(id).set(row, cells.slice()); },
    async clearRows(id, list) { for (const r of list) grid(id).delete(r); },
    async deleteRowsInRange(id, from, to) {
      for (const r of [...grid(id).keys()]) if (r >= from && (to === null || r <= to)) grid(id).delete(r);
    },
    async deleteRowShift(id, row) {
      const g = grid(id);
      g.delete(row);
      const later = [...g.keys()].filter(r => r > row).sort((a, b) => a - b);
      for (const r of later) { g.set(r - 1, g.get(r)); g.delete(r); }
    },
  };
}
