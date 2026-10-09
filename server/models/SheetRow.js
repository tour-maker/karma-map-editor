import mongoose from 'mongoose';

// One document per spreadsheet row. `row` is the 1-based position in its tab, `cells` the
// text of each column from A onward (trailing empty cells are not stored).
// Deliberately NOT a unique index: deleting a row renumbers the rows below it.
const SheetRowSchema = new mongoose.Schema({
  sheetId: { type: Number, required: true },
  row: { type: Number, required: true },
  cells: { type: [String], default: [] },
});
SheetRowSchema.index({ sheetId: 1, row: 1 });

export default mongoose.model('SheetRow', SheetRowSchema);
