import express from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import { convert } from '@omsimos/pdf-raster';
import PolygonDocument from '../models/PolygonDocument.js';
import Tile from '../models/Tile.js';

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

      // --- Tiling Process ---
      try {
        console.log(`[Tiling] Starting rasterization for document ${newDoc._id}...`);
        // Convert PDF to image buffer (returns an array of pages, we take the first page)
        // Adjust scale based on need; scale: 3 or 4 yields high quality
        const images = await convert(file.buffer, { scale: 3 });
        if (images && images.length > 0) {
          const imgBuffer = images[0].data; // extract the raw buffer from the object

          console.log(`[Tiling] Generating tiles for document ${newDoc._id}...`);
          const zipPath = path.join(os.tmpdir(), `tiles_${newDoc._id}.zip`);
          
          await sharp(imgBuffer)
            .png()
            .tile({ layout: 'google', size: 256 })
            .toFile(zipPath);

          console.log(`[Tiling] Tiles generated at ${zipPath}, extracting and saving to DB...`);
          const zip = new AdmZip(zipPath);
          const zipEntries = zip.getEntries();

          const tileDocs = [];
          for (const entry of zipEntries) {
            if (!entry.isDirectory && entry.entryName.endsWith('.png')) {
              // Format might be folder/z/x/y.png or z/x/y.png
              const parts = entry.entryName.split('/');
              if (parts.length >= 3) {
                const zIndex = parts.length - 3;
                const z = parseInt(parts[zIndex], 10);
                const y = parseInt(parts[zIndex + 1], 10);
                const x = parseInt(parts[zIndex + 2].replace('.png', ''), 10);
                const data = entry.getData();

                if (!isNaN(z) && !isNaN(x) && !isNaN(y)) {
                  tileDocs.push({
                    documentId: newDoc._id,
                    polygonId,
                    z,
                    x,
                    y,
                    data
                  });
                }
              }
            }
          }

          if (tileDocs.length > 0) {
            // Bulk insert for speed
            await Tile.insertMany(tileDocs);
            console.log(`[Tiling] Successfully saved ${tileDocs.length} tiles to MongoDB.`);
          } else {
            console.warn(`[Tiling] Warning: No tiles were parsed from the zip archive.`);
          }
        }
      } catch (tilingError) {
        console.error('[Tiling Error]', tilingError);
        // We don't fail the upload if tiling fails, but we log the error
      }
      
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
    // Clean up associated tiles
    await Tile.deleteMany({ documentId: req.params.id });
    
    res.json({ success: true, message: 'Document and tiles deleted' });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Serve a specific tile
router.get('/tiles/:documentId/:z/:x/:y', async (req, res) => {
  try {
    const { documentId, z, x, y } = req.params;
    
    // Y coordinate might include .png extension from leaflet URL template
    const parsedY = parseInt(y.replace('.png', ''), 10);
    
    const tile = await Tile.findOne({
      documentId,
      z: parseInt(z, 10),
      x: parseInt(x, 10),
      y: parsedY
    });

    if (!tile) {
      return res.status(404).send('Tile not found');
    }

    res.setHeader('Content-Type', 'image/png');
    // aggressive caching for tiles
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(tile.data);
  } catch (error) {
    console.error('Tile Fetch Error:', error);
    res.status(500).send('Failed to fetch tile');
  }
});

export default router;
