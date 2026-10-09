import { getGoogleSheets, SPREADSHEET_ID } from './googleClient.js';
import { isMongoStorage, getStorage } from './storage/index.js';

export { SPREADSHEET_ID };

// The sheet client the rest of the server uses. With STORAGE=mongo it is a drop-in stand-in
// backed by MongoDB (same methods as the Google client); otherwise it is the real Google client.
export const getSheets = () => (isMongoStorage() ? getStorage().engine : getGoogleSheets());

/**
 * Appends an approved submission as a new row in the Polygons sheet.
 * Columns: id, tp, op, fp, area, location, parent_location, landmark, type, remarks, Party Name, Party Phone, Broker Name, Broker Phone, coordinates
 */
export const appendApprovedSubmission = async (submission) => {
  const sheets = getSheets();
  // IDs are allocated independently for Sq Yard (s) and Wingha (w), based on
  // the highest matching ID already present in the sheet.
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Polygons!A:R',
  });
  const rows = existing.data.values || [];
  const prefix = /wingha|vingha|vigha/i.test(String(submission.areaUnit || '')) ? 'w' : 's';
  const maxId = rows.reduce((max, row) => {
    const match = String(row[0] || '').trim().match(/^([sw])(\d+)$/i);
    return match && match[1].toLowerCase() === prefix ? Math.max(max, Number(match[2])) : max;
  }, 0);
  const id = `${prefix}${maxId + 1}`;
  const coordsArray = Array.isArray(submission.coordinates) ? submission.coordinates : [];
  const coords = coordsArray.length > 0 ? JSON.stringify(coordsArray) : '';

  let centerPinLatLong = '';
  if (coordsArray.length > 0) {
    const validPoints = coordsArray.filter(c => c && typeof c.lat === 'number' && typeof c.lng === 'number');
    if (validPoints.length > 0) {
      const avgLat = validPoints.reduce((sum, c) => sum + c.lat, 0) / validPoints.length;
      const avgLng = validPoints.reduce((sum, c) => sum + c.lng, 0) / validPoints.length;
      centerPinLatLong = `${avgLat}, ${avgLng}`;
    }
  }

  const row = [
    id,
    submission.tp || '',
    submission.op || '',
    submission.fp || '',
    submission.area || '',
    submission.location || submission.parentLocation || '',
    submission.parentLocation || '',
    submission.landmark || '',
    submission.type || '',
    submission.remarks || '',
    '',  // Party Name
    '',  // Party Phone
    '',  // Broker Name
    '',  // Broker Phone
    coords,
    centerPinLatLong,
    '',  // reference
    submission.areaUnit || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Polygons!A:R',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  console.log(`[Sheets] Appended approved submission ${id} to Google Sheet`);
  return id;
};

/**
 * Removes an approved submission from the Polygons sheet by its allocated sheet ID.
 */
export const removeSubmissionFromSheet = async (submissionId) => {
  const sheets = getSheets();
  const idStr = submissionId.toString().trim();
  if (!idStr) throw new Error('Cannot delete an approved polygon without its Google Sheet ID.');

  // 1. Get column A to find the row index
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Polygons!A:A',
  });
  
  const rows = response.data.values || [];
  const matchingRowIndexes = [];
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]?.[0] || '').trim().toLowerCase() === idStr.toLowerCase()) matchingRowIndexes.push(i);
  }

  if (matchingRowIndexes.length !== 1) {
    throw new Error(matchingRowIndexes.length === 0
      ? `Approved polygon ${idStr} was not found in the sheet.`
      : `Approved polygon ID ${idStr} is duplicated in the sheet; refusing to delete an uncertain row.`);
  }
  const rowIndex = matchingRowIndexes[0];

  // 2. Get the sheetId (gid) for the "Polygons" sheet
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Polygons');
  if (!sheet) {
    throw new Error('Polygons sheet not found');
  }
  const sheetId = sheet.properties.sheetId;

  // 3. Delete the row
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1
            }
          }
        }
      ]
    }
  });

  console.log(`[Sheets] Removed rejected submission ${idStr} from Google Sheet at row ${rowIndex + 1}`);
};

