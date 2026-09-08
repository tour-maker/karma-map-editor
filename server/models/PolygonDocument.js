import mongoose from 'mongoose';

const polygonDocumentSchema = new mongoose.Schema({
  polygonId: { type: String, required: true, index: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  fileData: { type: Buffer, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

export default mongoose.model('PolygonDocument', polygonDocumentSchema);
