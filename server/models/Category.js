import mongoose from 'mongoose';

// A property category (Freehold, Residential, ...): its name and the colour used for its
// polygons and map pins. `aliases` keeps earlier names so old data and old links still resolve
// after an admin renames the category.
const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  // Lower-cased name: enforces "no two categories with the same name, ignoring capitals".
  key: { type: String, required: true, unique: true },
  color: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
  aliases: { type: [String], default: [] },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

export const DEFAULT_CATEGORIES = [
  { name: 'Residential', color: '#38bdf8' },
  { name: 'Commercial', color: '#f97316' },
  { name: 'Freehold', color: '#facc15' },
  { name: 'Industrial', color: '#a855f7' },
  { name: 'Agriculture', color: '#22c55e' },
  { name: 'Ready Farmhouse', color: '#ec4899' },
  { name: 'Rented', color: '#ef4444' }
];

export default mongoose.model('Category', CategorySchema);
