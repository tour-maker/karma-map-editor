import express from 'express';
import { getSheets, SPREADSHEET_ID } from '../sheetsHelper.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/sheets/values?range=Polygons
// @desc    Read a range's raw values from the sheet (public — the map is viewable by anyone)
router.get('/values', async (req, res) => {
  try {
    const { range } = req.query;
    if (!range) return res.status(400).json({ error: 'Missing range' });

    const sheets = getSheets();
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    res.json({ values: result.data.values || [] });
  } catch (error) {
    console.error('[sheets] GET /values error:', error.message);
    res.status(500).json({ error: 'Failed to read sheet data' });
  }
});

// @route   GET /api/sheets/metadata
// @desc    Read sheet tab names + ids (public)
router.get('/metadata', async (req, res) => {
  try {
    const sheets = getSheets();
    const result = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'sheets.properties',
    });
    res.json({ sheets: result.data.sheets || [] });
  } catch (error) {
    console.error('[sheets] GET /metadata error:', error.message);
    res.status(500).json({ error: 'Failed to read sheet metadata' });
  }
});

// @route   PUT /api/sheets/values
// @desc    Overwrite a range with values (Admin only)
router.put('/values', requireAdmin, async (req, res) => {
  try {
    const { range, values } = req.body;
    if (!range || !Array.isArray(values)) return res.status(400).json({ error: 'Missing range or values' });

    const sheets = getSheets();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { range, majorDimension: 'ROWS', values },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[sheets] PUT /values error:', error.message);
    res.status(500).json({ error: 'Failed to update sheet data' });
  }
});

// @route   POST /api/sheets/values/append
// @desc    Append rows to a range (Admin only)
router.post('/values/append', requireAdmin, async (req, res) => {
  try {
    const { range, values } = req.body;
    if (!range || !Array.isArray(values)) return res.status(400).json({ error: 'Missing range or values' });

    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { range, majorDimension: 'ROWS', values },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[sheets] POST /values/append error:', error.message);
    res.status(500).json({ error: 'Failed to append sheet data' });
  }
});

// @route   POST /api/sheets/values/clear
// @desc    Clear a range (Admin only)
router.post('/values/clear', requireAdmin, async (req, res) => {
  try {
    const { range } = req.body;
    if (!range) return res.status(400).json({ error: 'Missing range' });

    const sheets = getSheets();
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[sheets] POST /values/clear error:', error.message);
    res.status(500).json({ error: 'Failed to clear sheet data' });
  }
});

// @route   POST /api/sheets/batchUpdate
// @desc    Run a raw batchUpdate request (e.g. add a sheet tab, delete a row) (Admin only)
router.post('/batchUpdate', requireAdmin, async (req, res) => {
  try {
    const { requests } = req.body;
    if (!Array.isArray(requests)) return res.status(400).json({ error: 'Missing requests' });

    const sheets = getSheets();
    const result = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
    res.json({ success: true, replies: result.data.replies || [] });
  } catch (error) {
    console.error('[sheets] POST /batchUpdate error:', error.message);
    res.status(500).json({ error: 'Failed to run batch update' });
  }
});

export default router;
