import SheetTab from '../models/SheetTab.js';
import SheetRow from '../models/SheetRow.js';

// MongoDB storage for the sheet engine (same contract as memoryRepo.js).
export const mongoRepo = {
  async listTabs() {
    const tabs = await SheetTab.find({}).sort({ index: 1 }).lean();
    return tabs.map(t => ({ sheetId: t.sheetId, title: t.title, index: t.index }));
  },
  async tabByTitle(title) {
    const t = await SheetTab.findOne({ title }).lean();
    return t ? { sheetId: t.sheetId, title: t.title, index: t.index } : null;
  },
  async addTab(tab) { await SheetTab.create(tab); },
  async rowsInRange(sheetId, from, to) {
    const q = { sheetId, row: to === null ? { $gte: from } : { $gte: from, $lte: to } };
    const docs = await SheetRow.find(q).sort({ row: 1 }).lean();
    return docs.map(d => ({ row: d.row, cells: d.cells || [] }));
  },
  async lastRow(sheetId) {
    const d = await SheetRow.findOne({ sheetId }).sort({ row: -1 }).lean();
    return d ? d.row : 0;
  },
  async upsertRows(sheetId, list) {
    if (!list.length) return;
    await SheetRow.bulkWrite(list.map(({ row, cells }) => ({
      updateOne: { filter: { sheetId, row }, update: { $set: { cells } }, upsert: true },
    })));
  },
  async clearRows(sheetId, rows) {
    if (rows.length) await SheetRow.deleteMany({ sheetId, row: { $in: rows } });
  },
  async deleteRowsInRange(sheetId, from, to) {
    await SheetRow.deleteMany({ sheetId, row: to === null ? { $gte: from } : { $gte: from, $lte: to } });
  },
  async deleteRowShift(sheetId, row) {
    await SheetRow.deleteMany({ sheetId, row });
    await SheetRow.updateMany({ sheetId, row: { $gt: row } }, { $inc: { row: -1 } });
  },
};
