import { determineParentLocation, getPropertyTypeColor } from '../config/categories.js';
import { useMapStore } from '../store/useMapStore.js';

let tokenClient = null;
let accessToken = null;

export const initGoogleIdentity = (clientId, onTokenResponse) => {
  if (typeof window === 'undefined') return;

  if (!document.getElementById('google-gsi-script')) {
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        callback: (response) => {
          if (response.error !== undefined) {
            console.error('Google Auth Error:', response);
            return;
          }
          accessToken = response.access_token;
          if (onTokenResponse) onTokenResponse(accessToken);
        },
      });
    };
    document.body.appendChild(script);
  } else if (window.google?.accounts?.oauth2) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      callback: (response) => {
        if (response.error !== undefined) {
          console.error('Google Auth Error:', response);
          return;
        }
        accessToken = response.access_token;
        if (onTokenResponse) onTokenResponse(accessToken);
      },
    });
  }
};

export const requestLogin = () => {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    console.error('Token client not initialized');
  }
};

export const setAccessToken = (token) => {
  accessToken = token;
};

const sheetsFetch = async (url, options = {}) => {
  if (!accessToken) throw new Error('Not authenticated');
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Google Sheets API error');
  }
  return response.json();
};

export const fetchSheetData = async (spreadsheetId, range = 'Polygons') => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  return sheetsFetch(url);
};

export const updateSheetRow = async (spreadsheetId, range, values) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  return sheetsFetch(url, {
    method: 'PUT',
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: [values],
    }),
  });
};

export const appendSheetRow = async (spreadsheetId, range, values) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
  return sheetsFetch(url, {
    method: 'POST',
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: [values],
    }),
  });
};

export const appendSheetRows = async (spreadsheetId, range, multipleValues) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
  return sheetsFetch(url, {
    method: 'POST',
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: multipleValues,
    }),
  });
};

export const clearSheetData = async (spreadsheetId, range = 'Polygons') => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`;
  return sheetsFetch(url, {
    method: 'POST',
    body: JSON.stringify({}),
  });
};

export const deleteSheetRowByIndex = async (spreadsheetId, sheetId = 0, rowIndex) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  return sheetsFetch(url, {
    method: 'POST',
    body: JSON.stringify({
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
    }),
  });
};

export const getSheetIdByName = async (spreadsheetId, sheetName) => {
  if (!accessToken || !spreadsheetId || spreadsheetId === 'default') return null;
  try {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title,sheetId)`;
    const meta = await sheetsFetch(metaUrl);
    const sheet = (meta.sheets || []).find(s => s.properties?.title === sheetName);
    return sheet?.properties?.sheetId ?? null;
  } catch (err) {
    console.warn(`Could not get sheetId for ${sheetName}:`, err);
    return null;
  }
};

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6PYhg46pRnBkkcAfp-RkmreiGHIkwYLcNXI03eujyc1bSSTH0kZZ93auAm7XtcjI/exec';

export const syncLandmarkToSheet = async (landmarkFeature, spreadsheetId = null, action = 'create') => {
  if (!landmarkFeature) return;

  try {
    const d = landmarkFeature.data || {};
    const title = d.landmark || d.name || 'Landmark';
    const loc = d.location || 'Surat';
    const parentLoc = d.parentLocation || d.parent_location || determineParentLocation(loc);
    const lat = landmarkFeature.position?.lat || landmarkFeature.center?.lat || '';
    const lng = landmarkFeature.position?.lng || landmarkFeature.center?.lng || '';
    const remarksVal = d.remarks || (lat && lng ? `Lat: ${lat}, Lng: ${lng}` : '');

    // Format row for Landmarks (id, tp, op, fp, area, location, parent_location, landmark, type, remarks)
    const landmarkSheetRow = [
      landmarkFeature.id || `landmark-${Date.now()}`,
      '', // tp
      '', // op
      '', // fp
      '', // area
      loc,
      parentLoc,
      title,
      'Landmark',
      remarksVal
    ];

    // 1. Direct Google Sheets API update/append if connected
    let directApiSuccess = false;
    if (accessToken && spreadsheetId && spreadsheetId !== 'default') {
      try {
        await ensureSheetTabExists(spreadsheetId, 'landmarks', ['id', 'tp', 'op', 'fp', 'area', 'location', 'parent_location', 'landmark', 'type', 'remarks']);
        const sheetData = await fetchSheetData(spreadsheetId, 'landmarks');
        const rows = sheetData.values || [];
        let targetRowIndex = -1;

        if (rows.length > 0) {
          const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
          const idIdx = headers.indexOf('id');
          const landmarkIdx = headers.indexOf('landmark');
          const locIdx = headers.indexOf('location');

          const cleanStr = val => String(val || '').toLowerCase().trim();
          const fIdNorm = cleanStr(landmarkFeature.id);
          const fTitleNorm = cleanStr(title);
          const fLocNorm = cleanStr(loc);

          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            const rIdNorm = idIdx >= 0 ? cleanStr(r[idIdx]) : '';
            const rLandmarkNorm = landmarkIdx >= 0 ? cleanStr(r[landmarkIdx]) : '';
            const rLocNorm = locIdx >= 0 ? cleanStr(r[locIdx]) : '';

            if (fIdNorm && rIdNorm && rIdNorm === fIdNorm) {
              targetRowIndex = i + 1;
              break;
            }
            if (fTitleNorm && rLandmarkNorm && rLandmarkNorm === fTitleNorm && (rLocNorm === fLocNorm || !fLocNorm)) {
              targetRowIndex = i + 1;
              break;
            }
          }

          if (action === 'delete') {
            if (targetRowIndex > 1) {
              const sId = await getSheetIdByName(spreadsheetId, 'landmarks');
              if (sId !== null) {
                await deleteSheetRowByIndex(spreadsheetId, sId, targetRowIndex - 1);
              }
            }
          } else if (action === 'update' || action === 'edit') {
            if (targetRowIndex > 1) {
              await updateSheetRow(spreadsheetId, `landmarks!A${targetRowIndex}:J${targetRowIndex}`, landmarkSheetRow);
            } else {
              await appendSheetRow(spreadsheetId, 'landmarks!A:J', landmarkSheetRow);
            }
          } else {
            // Action is 'create' / 'add'
            if (targetRowIndex > 1) {
              await updateSheetRow(spreadsheetId, `landmarks!A${targetRowIndex}:J${targetRowIndex}`, landmarkSheetRow);
            } else {
              await appendSheetRow(spreadsheetId, 'landmarks!A:J', landmarkSheetRow);
            }
          }
        } else {
          await appendSheetRow(spreadsheetId, 'landmarks!A:J', landmarkSheetRow);
        }
        directApiSuccess = true;
      } catch (err) {
        console.warn('Direct Google Sheets API sync for landmark failed:', err);
      }
    }

    if (!directApiSuccess) {
      // 2. Apps Script backup sync
      const landmarkRow = [
        landmarkFeature.id || `landmark-${Date.now()}`,
        title,
        loc,
        parentLoc,
        lat ? String(lat) : '',
        lng ? String(lng) : '',
        d.remarks || ''
      ];

      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: action === 'delete' ? 'deleteLandmark' : 'saveLandmark',
          sheetName: 'landmarks',
          tabName: 'landmarks',
          row: landmarkRow,
          landmarkRow,
          landmark: {
            id: landmarkFeature.id,
            name: title,
            location: loc,
            parentLocation: parentLoc,
            lat,
            lng,
            remarks: d.remarks || ''
          }
        })
      });
    }
  } catch (err) {
    console.error('Failed to sync landmark to Google Sheets:', err);
  }
};

export const ensureSheetTabExists = async (spreadsheetId, title = 'Areas', headers = ['Parent Location', 'Secondary Location']) => {
  if (!accessToken || !spreadsheetId || spreadsheetId === 'default') return;

  try {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
    const meta = await sheetsFetch(metaUrl);
    const existingTitles = (meta.sheets || []).map(s => s.properties?.title);

    if (!existingTitles.includes(title)) {
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      await sheetsFetch(batchUrl, {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: { title }
              }
            }
          ]
        })
      });

      if (headers && headers.length > 0) {
        const lastColChar = String.fromCharCode(64 + headers.length);
        await updateSheetRow(spreadsheetId, `${title}!A1:${lastColChar}1`, headers);
      }
    }
  } catch (err) {
    console.warn(`Could not ensure sheet tab "${title}":`, err);
  }
};

export const syncAreaToSheet = async (parentLocation, subLocationsInput = [], spreadsheetId = null) => {
  if (!parentLocation || !parentLocation.trim()) return;

  const parent = parentLocation.trim();
  let subs = [];
  if (Array.isArray(subLocationsInput)) {
    subs = subLocationsInput.map(s => String(s || '').trim()).filter(Boolean);
  } else if (typeof subLocationsInput === 'string' && subLocationsInput.trim()) {
    subs = subLocationsInput.split(',').map(s => s.trim()).filter(Boolean);
  }

  const rowsToAppend = subs.length > 0
    ? subs.map(sub => [parent, sub])
    : [[parent, '']];

  // 1. Direct Google Sheets REST API sync to 'Areas' sheet tab (2 columns: Parent Location, Secondary Location)
  if (accessToken && spreadsheetId && spreadsheetId !== 'default') {
    try {
      await ensureSheetTabExists(spreadsheetId, 'Areas', ['Parent Location', 'Secondary Location']);
      await appendSheetRows(spreadsheetId, 'Areas!A:B', rowsToAppend);
    } catch (err) {
      console.warn('Direct Google Sheets API sync for Area failed:', err);
    }
  }

  // 2. Apps Script backup sync
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'saveArea',
        parentLocation: parent,
        subLocations: subs,
        rows: rowsToAppend
      })
    });
  } catch (err) {
    console.error('Apps Script area sync error:', err);
  }
};

export const fetchAreasFromSheet = async (spreadsheetId) => {
  if (!accessToken || !spreadsheetId || spreadsheetId === 'default') return [];

  try {
    const sheetData = await fetchSheetData(spreadsheetId, 'Areas!A:B');
    const rows = sheetData.values || [];
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
    const parentIdx = headers.findIndex(h => h.includes('parent'));
    const secIdx = headers.findIndex(h => h.includes('secondary') || h.includes('sub') || h.includes('location'));

    const pIdx = parentIdx >= 0 ? parentIdx : 0;
    const sIdx = secIdx >= 0 ? secIdx : 1;

    const loadedAreasMap = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const parent = String(row[pIdx] || '').trim();
      const secondary = String(row[sIdx] || '').trim();

      if (parent) {
        if (!loadedAreasMap[parent]) {
          loadedAreasMap[parent] = [];
        }
        if (secondary && !loadedAreasMap[parent].includes(secondary)) {
          loadedAreasMap[parent].push(secondary);
        }
      }
    }

    const store = useMapStore.getState();
    const { CATEGORY_MAP } = await import('../config/categories.js');
    Object.entries(loadedAreasMap).forEach(([pName, sList]) => {
      store.addCustomArea(pName);
      if (!CATEGORY_MAP[pName]) {
        CATEGORY_MAP[pName] = sList;
      } else {
        CATEGORY_MAP[pName] = Array.from(new Set([...(CATEGORY_MAP[pName] || []), ...sList]));
      }
    });

    return Object.keys(loadedAreasMap);
  } catch (err) {
    console.warn('Failed to fetch Areas sheet:', err);
    return [];
  }
};

export const repairSheet1Headers = async (spreadsheetId, sheetName = 'Polygons') => {
  if (!accessToken || !spreadsheetId || spreadsheetId === 'default') return;

  const correctHeaders = ['id', 'tp', 'op', 'fp', 'area', 'location', 'parent_location', 'landmark', 'type', 'remarks'];
  try {
    const sheetData = await fetchSheetData(spreadsheetId, `${sheetName}!A1:J1`);
    const rows = sheetData.values || [];
    const currentHeaderRow = rows[0] || [];
    
    // Check if header row is corrupted (e.g. empty or all 'ID' / repeated entries)
    const isCorrupted = currentHeaderRow.length === 0 || 
      currentHeaderRow.every(h => String(h || '').trim().toUpperCase() === 'ID') ||
      (currentHeaderRow[0] && String(currentHeaderRow[0]).trim().toLowerCase() === 'id' && currentHeaderRow[1] && String(currentHeaderRow[1]).trim().toLowerCase() === 'id');

    if (isCorrupted) {
      await updateSheetRow(spreadsheetId, `${sheetName}!A1:J1`, correctHeaders);
    }
  } catch (err) {
    console.warn(`Failed to check/repair ${sheetName} headers:`, err);
  }
};

export const syncFeatureToSheet = async (spreadsheetId, feature, action = 'update') => {
  if (!feature) return;

  if (feature.id?.startsWith('landmark-') || feature.data?.type === 'Landmark') {
    return syncLandmarkToSheet(feature, spreadsheetId, action);
  }

  try {
    const d = feature.data || {};
    const loc = d.location || feature.location || '';
    const parentLoc = d.parentLocation || d.parent_location || feature.parentLocation || determineParentLocation(loc) || '';
    const tpVal = d.tp || feature.tp || '';
    const opVal = d.op || feature.op || '';
    const fpVal = d.fp || feature.fp || '';
    const areaVal = d.area != null ? d.area : (feature.area != null ? feature.area : '');
    const landmarkVal = d.landmark || feature.landmark || '';
    const typeVal = d.type || feature.type || '';
    const remarksVal = d.remarks || feature.remarks || '';

    const cleanRow = [
      feature.id || '',
      tpVal,
      opVal,
      fpVal,
      areaVal,
      loc,
      parentLoc,
      landmarkVal,
      typeVal,
      remarksVal
    ];

    let targetRowIndex = -1;

    if (accessToken && spreadsheetId && spreadsheetId !== 'default') {
      try {
        await repairSheet1Headers(spreadsheetId, 'Polygons');
        const sheetData = await fetchSheetData(spreadsheetId, 'Polygons');
        const rows = sheetData.values || [];
        if (rows.length > 0) {
          const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
          const idIdx = headers.indexOf('id') >= 0 ? headers.indexOf('id') : 0;
          const tpIdx = headers.indexOf('tp') >= 0 ? headers.indexOf('tp') : 1;
          const opIdx = headers.indexOf('op') >= 0 ? headers.indexOf('op') : 2;
          const fpIdx = headers.indexOf('fp') >= 0 ? headers.indexOf('fp') : 3;

          const cleanStr = val => String(val || '').toLowerCase().replace(/^(tp|op|fp)[:\s]*/i, '').replace(/[^a-z0-9]/gi, '');

          const fIdNorm = cleanStr(feature.id);
          const fTpNorm = cleanStr(tpVal);
          const fOpNorm = cleanStr(opVal);
          const fFpNorm = cleanStr(fpVal);

          // Find exact row matching THIS specific polygon
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            const rIdNorm = idIdx >= 0 ? cleanStr(r[idIdx]) : '';
            const rTpNorm = tpIdx >= 0 ? cleanStr(r[tpIdx]) : '';
            const rOpNorm = opIdx >= 0 ? cleanStr(r[opIdx]) : '';
            const rFpNorm = fpIdx >= 0 ? cleanStr(r[fpIdx]) : '';

            // Priority 1: Match by unique ID
            if (fIdNorm && rIdNorm && rIdNorm === fIdNorm) {
              targetRowIndex = i + 1;
              break;
            }
            // Priority 2: Match by TP + OP + FP
            if (fTpNorm && fOpNorm && fFpNorm && rTpNorm === fTpNorm && rOpNorm === fOpNorm && rFpNorm === fFpNorm) {
              targetRowIndex = i + 1;
              break;
            }
            // Priority 3: Match by TP + FP
            if (fTpNorm && fFpNorm && rTpNorm === fTpNorm && rFpNorm === fFpNorm) {
              targetRowIndex = i + 1;
              break;
            }
          }

          // Strictly execute action: ONLY touch the targeted row if updating
          if (action === 'delete') {
            if (targetRowIndex > 1) {
              const sId = await getSheetIdByName(spreadsheetId, 'Polygons');
              if (sId !== null) {
                await deleteSheetRowByIndex(spreadsheetId, sId, targetRowIndex - 1);
              }
            }
          } else if (action === 'update' || action === 'edit' || action === 'save') {
            if (targetRowIndex > 1) {
              // Update ONLY the specific matched row
              await updateSheetRow(spreadsheetId, `Polygons!A${targetRowIndex}:J${targetRowIndex}`, cleanRow);
            } else {
              console.warn(`[syncFeatureToSheet] No matching row found in Google Sheet for polygon id="${feature.id}" (TP: ${tpVal}, FP: ${fpVal}). Skipping update to avoid creating new rows or overwriting unrelated polygons.`);
            }
          } else if (action === 'create' || action === 'add') {
            if (targetRowIndex > 1) {
              await updateSheetRow(spreadsheetId, `Polygons!A${targetRowIndex}:J${targetRowIndex}`, cleanRow);
            } else {
              await appendSheetRow(spreadsheetId, 'Polygons!A:J', cleanRow);
            }
          }
        }
      } catch (err) {
        console.warn('Direct Google Sheets API update error:', err);
      }
    }

    // Backup Apps Script call with targetRowIndex
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: action || 'update',
        id: feature.id,
        tp: tpVal,
        op: opVal,
        fp: fpVal,
        targetRowIndex: targetRowIndex > 1 ? targetRowIndex : -1,
        row: cleanRow
      })
    });
  } catch (err) {
    console.error('Apps Script sync error:', err);
  }
};

export const overwriteSheetWithFeatures = async (spreadsheetId, features = [], range = 'Polygons') => {
  const headers = ['id', 'tp', 'op', 'fp', 'area', 'location', 'parent_location', 'landmark', 'type', 'remarks'];
  
  const polygonFeatures = features.filter(f => !(f.id?.startsWith('landmark-') || f.data?.type === 'Landmark'));

  const rows = [
    headers,
    ...polygonFeatures.map(f => {
      const d = f.data || {};
      const parentLoc = d.parentLocation || d.parent_location || determineParentLocation(d.location);
      return [
        f.id || '',
        d.tp != null ? String(d.tp) : '',
        d.op != null ? String(d.op) : '',
        d.fp != null ? String(d.fp) : '',
        d.area != null ? String(d.area) : '',
        d.location || '',
        parentLoc || '',
        d.landmark || '',
        d.type || '',
        d.remarks || ''
      ];
    })
  ];

  await clearSheetData(spreadsheetId, range);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  return sheetsFetch(url, {
    method: 'PUT',
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: rows,
    }),
  });
};

export const overwriteAreasSheet = async (spreadsheetId, areaRows = []) => {
  if (!accessToken || !spreadsheetId || spreadsheetId === 'default' || areaRows.length === 0) return;

  try {
    await ensureSheetTabExists(spreadsheetId, 'Areas', ['Parent Location', 'Secondary Location']);
    await clearSheetData(spreadsheetId, 'Areas!A:Z');
    await updateSheetRow(spreadsheetId, `Areas!A1:B${areaRows.length}`, areaRows);
  } catch (err) {
    console.warn('Direct Google Sheets API overwrite for Areas failed:', err);
  }
};

export const fetchAndMergeSheetUpdates = async (spreadsheetId) => {
  try {
    let polygonsData = [];
    let areasData = [];
    let landmarksData = [];

    if (spreadsheetId && accessToken) {
      // 1. Direct API Fetch
      try {
        const pUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Polygons`;
        const pRes = await sheetsFetch(pUrl);
        if (pRes && pRes.values) polygonsData = pRes.values;
        
        const aUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Areas`;
        const aRes = await sheetsFetch(aUrl);
        if (aRes && aRes.values) areasData = aRes.values;
        
        const lUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/landmarks`;
        const lRes = await sheetsFetch(lUrl);
        if (lRes && lRes.values) landmarksData = lRes.values;
      } catch (err) {
        console.warn('Failed to fetch via Direct API, falling back to Apps Script webhook:', err);
      }
    }

    if (polygonsData.length === 0) {
      // 2. Fallback to Webhook
      const res = await fetch(APPS_SCRIPT_URL);
      if (!res.ok) return 0;
      const result = await res.json();
      polygonsData = result.data || result.values || result.rows || [];
      areasData = result.areas || [];
      landmarksData = result.landmarks || [];
    }

    if (!polygonsData || polygonsData.length < 2) return 0;
    
    // Process Areas
    if (areasData && Array.isArray(areasData) && areasData.length > 1) {
      try {
        const loadedAreasMap = {};
        for (let i = 1; i < areasData.length; i++) {
          const r = areasData[i];
          if (!r || !Array.isArray(r) || r.length === 0) continue;
          const parent = String(r[0] || '').trim();
          const secondary = String(r[1] || '').trim();
          if (parent && parent.toLowerCase() !== 'parent location') {
            if (!loadedAreasMap[parent]) loadedAreasMap[parent] = [];
            if (secondary && !loadedAreasMap[parent].includes(secondary)) {
              loadedAreasMap[parent].push(secondary);
            }
          }
        }
        const store = useMapStore.getState();
        const { CATEGORY_MAP } = await import('../config/categories.js');
        Object.entries(loadedAreasMap).forEach(([pName, sList]) => {
          store.addCustomArea(pName);
          if (!CATEGORY_MAP[pName]) {
            CATEGORY_MAP[pName] = sList;
          } else {
            CATEGORY_MAP[pName] = Array.from(new Set([...(CATEGORY_MAP[pName] || []), ...sList]));
          }
        });
      } catch (err) {
        console.warn('Failed to parse areas:', err);
      }
    }

    const currentFeatures = useMapStore.getState().features;
    let updateCount = 0;

    // Process Polygons
    const rawHeaders = polygonsData[0].map(h => String(h || '').trim().toLowerCase());
    const isCorruptedHeaders = rawHeaders.length === 0 || rawHeaders.filter(h => h === 'id').length > 2;
    const idIdx = !isCorruptedHeaders && rawHeaders.indexOf('id') >= 0 ? rawHeaders.indexOf('id') : 0;
    const tpIdx = !isCorruptedHeaders && rawHeaders.indexOf('tp') >= 0 ? rawHeaders.indexOf('tp') : 1;
    const opIdx = !isCorruptedHeaders && rawHeaders.indexOf('op') >= 0 ? rawHeaders.indexOf('op') : 2;
    const fpIdx = !isCorruptedHeaders && rawHeaders.indexOf('fp') >= 0 ? rawHeaders.indexOf('fp') : 3;
    const areaIdx = !isCorruptedHeaders && rawHeaders.indexOf('area') >= 0 ? rawHeaders.indexOf('area') : 4;
    const locIdx = !isCorruptedHeaders && rawHeaders.indexOf('location') >= 0 ? rawHeaders.indexOf('location') : 5;
    const parentLocIdx = !isCorruptedHeaders && (rawHeaders.indexOf('parent location') >= 0 ? rawHeaders.indexOf('parent location') : rawHeaders.indexOf('parent_location')) >= 0 ? (rawHeaders.indexOf('parent location') >= 0 ? rawHeaders.indexOf('parent location') : rawHeaders.indexOf('parent_location')) : 6;
    const landmarkIdx = !isCorruptedHeaders && rawHeaders.indexOf('landmark') >= 0 ? rawHeaders.indexOf('landmark') : 7;
    const catIdx = !isCorruptedHeaders && (rawHeaders.indexOf('category') >= 0 ? rawHeaders.indexOf('category') : rawHeaders.indexOf('type')) >= 0 ? (rawHeaders.indexOf('category') >= 0 ? rawHeaders.indexOf('category') : rawHeaders.indexOf('type')) : 8;
    const remarksIdx = !isCorruptedHeaders && rawHeaders.indexOf('remarks') >= 0 ? rawHeaders.indexOf('remarks') : 9;

    const sheetMap = new Map();
    for (let i = 1; i < polygonsData.length; i++) {
      const row = polygonsData[i];
      if (!Array.isArray(row)) continue;
      const id = idIdx >= 0 ? String(row[idIdx] || '').trim() : '';
      const tp = tpIdx >= 0 ? String(row[tpIdx] || '').trim() : '';
      const fp = fpIdx >= 0 ? String(row[fpIdx] || '').trim() : '';

      const rowData = {
        id, tp, op: opIdx >= 0 ? String(row[opIdx] || '').trim() : '', fp,
        area: areaIdx >= 0 ? String(row[areaIdx] || '').trim() : '',
        location: locIdx >= 0 ? String(row[locIdx] || '').trim() : '',
        parentLocation: parentLocIdx >= 0 ? String(row[parentLocIdx] || '').trim() : '',
        landmark: landmarkIdx >= 0 ? String(row[landmarkIdx] || '').trim() : '',
        type: catIdx >= 0 ? String(row[catIdx] || '').trim() : '',
        remarks: remarksIdx >= 0 ? String(row[remarksIdx] || '').trim() : ''
      };

      if (id) sheetMap.set(`id:${id}`, rowData);
      if (tp && fp) sheetMap.set(`tpfp:${tp}_${fp}`, rowData);
    }

    // Process Landmarks (7 columns)
    if (landmarksData && landmarksData.length > 1) {
      const lHeaders = landmarksData[0].map(h => String(h || '').trim().toLowerCase());
      const lIdIdx = lHeaders.indexOf('id') >= 0 ? lHeaders.indexOf('id') : 0;
      const lNameIdx = lHeaders.indexOf('landmark name') >= 0 ? lHeaders.indexOf('landmark name') : 1;
      const lLocIdx = lHeaders.indexOf('location') >= 0 ? lHeaders.indexOf('location') : 2;
      const lParentLocIdx = lHeaders.indexOf('parent location') >= 0 ? lHeaders.indexOf('parent location') : 3;
      const lLatIdx = lHeaders.indexOf('latitude') >= 0 ? lHeaders.indexOf('latitude') : 4;
      const lLngIdx = lHeaders.indexOf('longitude') >= 0 ? lHeaders.indexOf('longitude') : 5;
      const lRemarksIdx = lHeaders.indexOf('remarks') >= 0 ? lHeaders.indexOf('remarks') : 6;

      for (let i = 1; i < landmarksData.length; i++) {
        const row = landmarksData[i];
        if (!Array.isArray(row)) continue;
        const id = lIdIdx >= 0 ? String(row[lIdIdx] || '').trim() : '';
        if (id) {
          sheetMap.set(`id:${id}`, {
            id,
            name: lNameIdx >= 0 ? String(row[lNameIdx] || '').trim() : '',
            landmark: lNameIdx >= 0 ? String(row[lNameIdx] || '').trim() : '',
            location: lLocIdx >= 0 ? String(row[lLocIdx] || '').trim() : '',
            parentLocation: lParentLocIdx >= 0 ? String(row[lParentLocIdx] || '').trim() : '',
            lat: lLatIdx >= 0 ? String(row[lLatIdx] || '').trim() : '',
            lng: lLngIdx >= 0 ? String(row[lLngIdx] || '').trim() : '',
            remarks: lRemarksIdx >= 0 ? String(row[lRemarksIdx] || '').trim() : '',
            type: 'Landmark'
          });
        }
      }
    }

    const updatedFeatures = currentFeatures.map(f => {
      const d = f.data || {};
      const sheetMatch = sheetMap.get(`id:${f.id}`) || sheetMap.get(`tpfp:${d.tp}_${d.fp}`);
      if (!sheetMatch) return f;
      
      const isLandmarkType = f.id?.startsWith('landmark-') || d.type === 'Landmark';

      if (isLandmarkType) {
        const nameChanged = sheetMatch.name && sheetMatch.name !== (d.name || d.landmark || '');
        const locChanged = sheetMatch.location && sheetMatch.location !== (d.location || '');
        const remarksChanged = sheetMatch.remarks && sheetMatch.remarks !== (d.remarks || '');
        if (nameChanged || locChanged || remarksChanged) {
          updateCount++;
          return {
            ...f,
            data: {
              ...d,
              name: sheetMatch.name || d.name || d.landmark || '',
              landmark: sheetMatch.name || d.landmark || d.name || '',
              location: sheetMatch.location || d.location || '',
              parentLocation: sheetMatch.parentLocation || determineParentLocation(sheetMatch.location || d.location),
              remarks: sheetMatch.remarks || d.remarks || ''
            }
          };
        }
      } else {
        const tpChanged = sheetMatch.tp && sheetMatch.tp !== (d.tp || '');
        const opChanged = sheetMatch.op && sheetMatch.op !== (d.op || '');
        const fpChanged = sheetMatch.fp && sheetMatch.fp !== (d.fp || '');
        const areaChanged = sheetMatch.area && String(sheetMatch.area) !== String(d.area || '');
        const locChanged = sheetMatch.location && sheetMatch.location !== (d.location || '');
        const landmarkChanged = sheetMatch.landmark && sheetMatch.landmark !== (d.landmark || '');
        const typeChanged = sheetMatch.type && sheetMatch.type !== (d.type || '');
        const remarksChanged = sheetMatch.remarks && sheetMatch.remarks !== (d.remarks || '');

        if (tpChanged || opChanged || fpChanged || areaChanged || locChanged || landmarkChanged || typeChanged || remarksChanged) {
          updateCount++;
          const newType = sheetMatch.type || d.type;
          const newColor = getPropertyTypeColor(newType);
          return {
            ...f,
            data: {
              ...d,
              tp: sheetMatch.tp || d.tp || '',
              op: sheetMatch.op || d.op || '',
              fp: sheetMatch.fp || d.fp || '',
              area: sheetMatch.area || d.area || '',
              location: sheetMatch.location || d.location || '',
              parentLocation: sheetMatch.parentLocation || determineParentLocation(sheetMatch.location || d.location),
              landmark: sheetMatch.landmark || d.landmark || '',
              type: newType || '',
              remarks: sheetMatch.remarks || d.remarks || ''
            },
            style: {
              ...f.style,
              fillColor: newColor,
              strokeColor: newColor
            }
          };
        }
      }
      return f;
    });

    if (updateCount > 0) {
      useMapStore.getState().setFeatures(updatedFeatures);
    }

    return updateCount;
  } catch (err) {
    console.error('Failed to sync Google Sheets updates to Map Editor:', err);
    return 0;
  }
};
