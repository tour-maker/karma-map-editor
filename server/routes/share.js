import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getSheets, SPREADSHEET_ID } from '../sheetsHelper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// server/routes/share.js -> server/routes -> server -> repo root -> dist/index.html
const DIST_INDEX_PATH = join(__dirname, '..', '..', 'dist', 'index.html');

const SITE_ORIGIN = 'https://karmalandtour.360eye.tech';
const GENERIC_TITLE = 'Karma Map Editor - Interactive Real Estate & Property Mapping Tool';
const GENERIC_DESCRIPTION = 'Interactive map editor for viewing, editing, matching, and managing real estate property polygons, landmarks, and spatial analytics.';
const GENERIC_IMAGE = `${SITE_ORIGIN}/favicon.png`;

// Columns in the Polygons sheet (A:S), 0-indexed to match the array returned
// by a Polygons!A:S values.get call:
// 0 id, 1 tp, 2 op, 3 fp, 4 area, 5 location, 6 parent_location, 7 landmark,
// 8 type, 9 remarks, 10 Party Name, 11 Party Phone, 12 Broker Name,
// 13 Broker Phone, 14 coordinates, 15 center pin lat long, 16 reference,
// 17 area unit, 18 last updated
const COL = {
  id: 0,
  tp: 1,
  op: 2,
  fp: 3,
  area: 4,
  location: 5,
  parentLocation: 6,
  landmark: 7,
  type: 8,
  remarks: 9,
  areaUnit: 17,
};

const router = express.Router();

/**
 * Fetches just the single row (if any) matching `id` from the Polygons sheet,
 * without pulling in all of sheetsHelper.js's write-side logic.
 */
async function findPolygonRowById(id) {
  const sheets = getSheets();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Polygons!A:S',
  });

  const rows = result.data.values || [];
  const idStr = String(id);
  const row = rows.find((r) => r[COL.id] === idStr);
  return row || null;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTitleAndDescription(row) {
  if (!row) {
    return { title: GENERIC_TITLE, description: GENERIC_DESCRIPTION };
  }

  const area = row[COL.area] || '';
  const areaUnit = row[COL.areaUnit] || 'sq. yard';
  const type = row[COL.type] || 'Land';
  const location = row[COL.location] || 'Surat';
  const parentLocation = row[COL.parentLocation] || '';
  const tp = row[COL.tp] || '';
  const op = row[COL.op] || '';
  const fp = row[COL.fp] || '';
  const landmark = row[COL.landmark] || '';
  const remarks = row[COL.remarks] || '';

  const areaPart = area ? `${area} ${areaUnit}` : '';
  const locationPart = parentLocation ? `${location}, ${parentLocation}` : location;

  const title = `${[areaPart, type].filter(Boolean).join(' ')} Plot - ${locationPart} | Karma Realtors`;

  const tpFp = [
    tp ? `TP: ${tp}` : '',
    op ? `OP: ${op}` : '',
    fp ? `FP: ${fp}` : '',
  ].filter(Boolean).join(' | ');

  const descriptionParts = [
    tpFp,
    landmark ? `Near ${landmark}` : '',
    remarks || '',
  ].filter(Boolean);

  const description = descriptionParts.length > 0
    ? descriptionParts.join(' - ')
    : GENERIC_DESCRIPTION;

  return { title, description };
}

// @route   GET /share/:id
// @desc    Serve the built index.html with property-specific Open Graph /
//          Twitter tags swapped in, so link previews (WhatsApp, etc.) show
//          real property details instead of the generic site-wide tags.
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  let title = GENERIC_TITLE;
  let description = GENERIC_DESCRIPTION;

  try {
    const row = await findPolygonRowById(id);
    ({ title, description } = buildTitleAndDescription(row));
  } catch (error) {
    // Bad/old id, sheet unreachable, etc. — fall back to the generic tags
    // rather than failing the request.
    console.warn(`[share] Could not look up polygon "${id}" for link preview, using generic tags:`, error.message);
  }

  let html;
  try {
    html = readFileSync(DIST_INDEX_PATH, 'utf8');
  } catch (error) {
    console.warn('[share] Could not read dist/index.html (no build present?):', error.message);
    return res
      .status(200)
      .type('html')
      .send(`<!doctype html><html><head><title>${escapeHtml(title)}</title></head><body>${escapeHtml(title)}</body></html>`);
  }

  const shareUrl = `${SITE_ORIGIN}/share/${encodeURIComponent(id)}`;
  const escTitle = escapeHtml(title);
  const escDescription = escapeHtml(description);

  html = html
    .replace(/<title>.*?<\/title>/s, `<title>${escTitle}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escDescription}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${escTitle}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${escDescription}$2`)
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${GENERIC_IMAGE}$2`)
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${shareUrl}$2`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${escTitle}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${escDescription}$2`)
    .replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/, `$1${GENERIC_IMAGE}$2`);

  res.type('html').send(html);
});

export default router;
