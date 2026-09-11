import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1-9eVBefBNnBJMp4iQBlnA4wdHmEiinHERilgu-b7GQ4';

// Load service account credentials
const credentials = JSON.parse(
  readFileSync(join(__dirname, 'service-account.json'), 'utf8')
);

// Create authenticated Google Sheets client
export const getSheets = () => {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

/**
 * Appends an approved submission as a new row in the Polygons sheet.
 * Columns: id, tp, op, fp, area, location, parent_location, landmark, type, remarks, Party Name, Party Phone, Broker Name, Broker Phone, coordinates
 */
export const appendApprovedSubmission = async (submission) => {
  const sheets = getSheets();

  const id = submission._id?.toString() || `drawn-${Date.now()}`;
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
    submission.location || '',
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
 * Removes a submission from the Polygons sheet by searching for its ID in Column A.
 */
export const removeSubmissionFromSheet = async (submissionId) => {
  const sheets = getSheets();
  const idStr = submissionId.toString();

  // 1. Get column A to find the row index
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Polygons!A:A',
  });
  
  const rows = response.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === idStr) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    console.log(`[Sheets] Submission ${idStr} not found in sheet, skipping delete.`);
    return;
  }

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

