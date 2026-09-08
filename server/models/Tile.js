import mongoose from 'mongoose';

const tileSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PolygonDocument',
    required: true
  },
  polygonId: {
    type: String,
    required: true
  },
  z: {
    type: Number,
    required: true
  },
  x: {
    type: Number,
    required: true
  },
  y: {
    type: Number,
    required: true
  },
  data: {
    type: Buffer,
    required: true
  }
});

// Compound index for super fast tile lookups
tileSchema.index({ documentId: 1, z: 1, x: 1, y: 1 }, { unique: true });

export default mongoose.model('Tile', tileSchema);
