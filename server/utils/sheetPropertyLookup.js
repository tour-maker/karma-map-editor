import { getSheets, SPREADSHEET_ID } from '../sheetsHelper.js';

// Mirrors the column-header detection in src/services/googleSheets.js
// (fetchAndMergeSheetUpdates) so a plot's live data is read from the exact
// same source and column layout the app itself uses — no separate/stale copy.
function indexOf(headers, name, fallback) {
  const idx = headers.indexOf(name);
  return idx >= 0 ? idx : fallback;
}

function cell(row, idx) {
  return idx >= 0 && idx < row.length ? String(row[idx] || '').trim() : '';
}

/**
 * Looks up a single property's current live data from the "Polygons" sheet by its id
 * (or, failing that, by its TP/FP combo — same fallback the client uses for matching).
 * Returns null when the id doesn't resolve to a real row, so callers can fall back to
 * generic content instead of showing stale or fabricated data.
 */
export async function findPropertyById(rawId) {
  const id = String(rawId || '').trim();
  if (!id) return null;

  const sheets = getSheets();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Polygons',
  });
  const rows = result.data.values || [];
  if (rows.length < 2) return null;

  const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
  const idIdx = indexOf(headers, 'id', 0);
  const tpIdx = indexOf(headers, 'tp', 1);
  const opIdx = indexOf(headers, 'op', 2);
  const fpIdx = indexOf(headers, 'fp', 3);
  const areaIdx = indexOf(headers, 'area', 4);
  const locIdx = indexOf(headers, 'location', 5);
  const parentLocIdx = headers.indexOf('parent location') >= 0
    ? headers.indexOf('parent location')
    : indexOf(headers, 'parent_location', 6);
  const catIdx = headers.indexOf('category') >= 0 ? headers.indexOf('category') : indexOf(headers, 'type', 8);
  const areaUnitIdx = indexOf(headers, 'area unit', 17);

  let byTpFp = null;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const rowId = cell(row, idIdx);
    const tp = cell(row, tpIdx);
    const fp = cell(row, fpIdx);

    const matchesId = rowId && rowId === id;
    const matchesTpFp = !matchesId && (tp || fp) && `${tp}_${fp}` === id;
    if (!matchesId && !matchesTpFp) continue;

    const property = {
      id: rowId || id,
      tp,
      op: cell(row, opIdx),
      fp,
      area: cell(row, areaIdx),
      areaUnit: cell(row, areaUnitIdx),
      location: cell(row, locIdx),
      parentLocation: cell(row, parentLocIdx),
      type: cell(row, catIdx),
    };

    if (matchesId) return property; // exact id match wins outright
    if (!byTpFp) byTpFp = property;
  }

  return byTpFp;
}
