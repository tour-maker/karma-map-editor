import mongoose from 'mongoose';

// Audit trail for admin changes to the area structure. Its main job is remembering where plots
// came from when they land in "Unassigned" (the sheet itself only keeps the final location).
const PlotRefSchema = new mongoose.Schema({
  id: { type: String, required: true },
  fromParent: { type: String, default: '' },
  fromLocation: { type: String, default: '' }
}, { _id: false });

const AreaEventSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['delete-area', 'delete-sub', 'rehome', 'rename-area', 'rename-sub']
  },
  // The area or sub-area the action was about (and its Primary, for sub-areas).
  area: { type: String, default: '' },
  parent: { type: String, default: '' },
  // Rename target, or the destination of a rehome.
  to: { type: String, default: '' },
  toParent: { type: String, default: '' },
  plots: { type: [PlotRefSchema], default: [] },
  by: { type: String, default: 'admin' }
}, { timestamps: true });

AreaEventSchema.index({ 'plots.id': 1, createdAt: -1 });

export default mongoose.model('AreaEvent', AreaEventSchema);
