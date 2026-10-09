import mongoose from 'mongoose';

// Single document (key "mirror") remembering the Mongo -> Google Sheet copy:
// which tabs still need copying, and whether the one-time migration has been done.
const SyncStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  dirtyTabs: { type: [String], default: [] },
  migratedAt: { type: Date, default: null },
  lastSyncAt: { type: Date, default: null },
  lastError: { type: String, default: '' },
});

export default mongoose.model('SyncState', SyncStateSchema);
