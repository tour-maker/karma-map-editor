import mongoose from 'mongoose';

// One document per spreadsheet tab (Polygons, Areas, Landmarks, ...). sheetId mirrors the
// Google gid so the app's "delete this row" calls keep working unchanged.
const SheetTabSchema = new mongoose.Schema({
  sheetId: { type: Number, required: true, unique: true },
  title: { type: String, required: true, unique: true },
  index: { type: Number, default: 0 },
});

export default mongoose.model('SheetTab', SheetTabSchema);
