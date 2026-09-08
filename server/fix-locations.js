import { getSheets } from './sheetsHelper.js';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1-9eVBefBNnBJMp4iQBlnA4wdHmEiinHERilgu-b7GQ4';

async function fixCorruptedLocations() {
  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Polygons!A:O',
    });
    
    const rows = response.data.values || [];
    if (rows.length === 0) return console.log('No data found.');
    
    const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
    const locIdx = headers.indexOf('location');
    const parentLocIdx = headers.indexOf('parent location') >= 0 ? headers.indexOf('parent location') : headers.indexOf('parent_location');
    
    if (locIdx === -1 || parentLocIdx === -1) return console.log('Columns not found.');
    
    let updates = 0;
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      
      const loc = String(row[locIdx] || '').trim();
      
      if (loc.toLowerCase().startsWith('surat, ')) {
        const fixedLoc = loc.substring(7).trim();
        console.log(`Fixing row ${i + 1}: "${loc}" -> "${fixedLoc}"`);
        
        row[locIdx] = fixedLoc;
        row[parentLocIdx] = 'Surat';
        
        // Pad array if needed
        while (row.length < 15) row.push('');
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Polygons!A${i + 1}:O${i + 1}`,
          valueInputOption: 'RAW',
          requestBody: { values: [row] },
        });
        updates++;
      }
    }
    
    console.log(`Done! Fixed ${updates} rows.`);
  } catch (error) {
    console.error('Error:', error);
  }
}

fixCorruptedLocations();
