import express from 'express';
import multer from 'multer';
import PolygonDocument from '../models/PolygonDocument.js';

const router = express.Router();

// Setup Multer to store files in memory with a 15MB limit
// (MongoDB documents have a strict 16MB BSON limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// Upload one or multiple PDFs for a polygon
router.post('/:polygonId', upload.array('pdfs', 10), async (req, res) => {
  try {
    const { polygonId } = req.params;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const savedDocs = [];
    
    for (const file of req.files) {
      // Basic validation to ensure it's a PDF
      if (file.mimetype !== 'application/pdf') {
        continue; // Skip non-PDFs if any snuck past frontend validation
      }
      
      const newDoc = new PolygonDocument({
        polygonId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        fileData: file.buffer
      });
      
      await newDoc.save();
      
      // Return metadata without the heavy buffer
      savedDocs.push({
        _id: newDoc._id,
        polygonId: newDoc.polygonId,
        originalName: newDoc.originalName,
        size: newDoc.size,
        uploadedAt: newDoc.uploadedAt
      });
    }

    res.status(201).json(savedDocs);
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Failed to upload documents' });
  }
});

// Get a list of documents for a polygon (metadata only)
router.get('/:polygonId', async (req, res) => {
  try {
    const { polygonId } = req.params;
    const docs = await PolygonDocument.find({ polygonId }).select('-fileData');
    res.json(docs);
  } catch (error) {
    console.error('Fetch Docs Error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Download a specific document by ID
router.get('/download/:id', async (req, res) => {
  try {
    const doc = await PolygonDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
    res.send(doc.fileData);
  } catch (error) {
    console.error('Download Error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Delete a specific document by ID
router.delete('/:id', async (req, res) => {
  try {
    const doc = await PolygonDocument.findByIdAndDelete(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
