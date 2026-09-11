import { determineParentLocation, getPropertyTypeColor, CATEGORY_MAP } from '../config/categories.js';
import { useMapStore } from '../store/useMapStore.js';
import { calculatePolygonCenter } from './googleMaps.js';

let tokenClient = null;
let accessToken = null;
let _autoRefreshTimer = null;
let _onTokenResponseCallback = null;

const _handleTokenResponse = (response) => {
  if (response.error !== undefined) {
    console.warn('Google silent auth failed:', response.error);
    return;
  }
  accessToken = response.access_token;
  if (_onTokenResponseCallback) _onTokenResponseCallback(accessToken);
};

const _initTokenClient = (clientId) => {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    callback: _handleTokenResponse,
  });
};

export const initGoogleIdentity = (clientId, onTokenResponse) => {
  if (typeof window === 'undefined') return;
  _onTokenResponseCallback = onTokenResponse;

  if (!document.getElementById('google-gsi-script')) {
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      _initTokenClient(clientId);
      // Attempt silent login immediately after GSI loads
      silentLogin();
    };
    document.body.appendChild(script);
  } else if (window.google?.accounts?.oauth2) {
    _initTokenClient(clientId);
    silentLogin();
  }
};

/**
 * Silently refreshes the Google access token with no popup.
 * Works only if the user has previously consented in this browser.
 */
export const silentLogin = () => {
  if (!tokenClient) return;
  try {
    tokenClient.requestAccessToken({ prompt: '' });
  } catch (err) {
    console.warn('Silent login failed (user may need to log in manually):', err);
  }
};

/**
 * Starts an auto-refresh timer that silently renews the token every 55 minutes.
 * Call this once after successful authentication.
 */
export const startAutoRefresh = () => {
  if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
  // Refresh every 55 minutes (tokens expire at 60 min)
  _autoRefreshTimer = setInterval(() => {
    console.log('[GoogleAuth] Auto-refreshing token silently...');
    silentLogin();
  }, 55 * 60 * 1000);
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

export const isGoogleAuthenticated = () => {
  return !!accessToken;
};

// --- Backend-proxied Sheets access -----------------------------------------
// All reads/writes now go through our own server, which talks to Google
// Sheets using a service account. This removes the dependency on a browser
// OAuth session (which requires per-origin setup and expires hourly), and
// closes off the destructive fallback path that used to fire when that
// session was missing.
const BACKEND_URL = 'http://localhost:5050';

const adminAuthHeaders = () => {
  const jwt = localStorage.getItem('karmaAdminJWT');
  return jwt ? { 'Authorization': `Bearer ${jwt}` } : {};
};

const backendFetch = async (path, options = {}) => {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.method && options.method !== 'GET' ? adminAuthHeaders() : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Sheets backend error');
  }
  return response.json();
};

export const sheetsFetch = backendFetch;

export const fetchSheetData = async (_spreadsheetId, range = 'Polygons') => {
  return backendFetch(`/api/sheets/values?range=${encodeURIComponent(range)}`);
};

export const updateSheetRow = async (_spreadsheetId, range, values) => {
  return backendFetch('/api/sheets/values', {
    method: 'PUT',
    body: JSON.stringify({ range, values }),
  });
};

export const appendSheetRow = async (_spreadsheetId, range, values) => {
  return backendFetch('/api/sheets/values/append', {
    method: 'POST',
    body: JSON.stringify({ range, values: [values] }),
  });
};

export const appendSheetRows = async (_spreadsheetId, range, multipleValues) => {
  return backendFetch('/api/sheets/values/append', {
    method: 'POST',
    body: JSON.stringify({ range, values: multipleValues }),
  });
};

export const clearSheetData = async (_spreadsheetId, range = 'Polygons') => {
  return backendFetch('/api/sheets/values/clear', {
    method: 'POST',
    body: JSON.stringify({ range }),
  });
};

export const deleteSheetRowByIndex = async (_spreadsheetId, sheetId = 0, rowIndex) => {
  return backendFetch('/api/sheets/batchUpdate', {
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

export const getSheetIdByName = async (_spreadsheetId, sheetName) => {
  try {
    const meta = await backendFetch('/api/sheets/metadata');
    const sheet = (meta.sheets || []).find(s => s.properties?.title === sheetName);
    return sheet?.properties?.sheetId ?? null;
  } catch (err) {
    console.warn(`Could not get sheetId for ${sheetName}:`, err);
    return null;
  }
};

export const syncLandmarkToSheet = async (landmarkFeature, spreadsheetId = null, action = 'create') => {
  if (!landmarkFeature) return;

  if (!spreadsheetId || spreadsheetId === 'default') {
    throw new Error('No Google Sheet is configured.');
  }

  try {
    const d = landmarkFeature.data || {};
    const title = d.landmark || d.name || 'Landmark';
    const lat = landmarkFeature.position?.lat || landmarkFeature.center?.lat || '';
    const lng = landmarkFeature.position?.lng || landmarkFeature.center?.lng || '';
    const remarksVal = d.remarks || (lat && lng ? `Lat: ${lat}, Lng: ${lng}` : '');

    // Format row for Landmarks: id, Landmark Name, Latitude, Longitude, Remarks
    const landmarkSheetRow = [
      landmarkFeature.id || `landmark-${Date.now()}`,
      title,
      lat ? String(lat) : '',
      lng ? String(lng) : '',
      remarksVal
    ];

    await ensureSheetTabExists(spreadsheetId, 'Landmarks', ['id', 'Landmark Name', 'Latitude', 'Longitude', 'Remarks']);
    const sheetData = await fetchSheetData(spreadsheetId, 'Landmarks');
    const rows = sheetData.values || [];
    let targetRowIndex = -1;

    if (rows.length > 0) {
      const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
      const idIdx = headers.indexOf('id');
      const landmarkIdx = headers.indexOf('landmark name');

      const cleanStr = val => String(val || '').toLowerCase().trim();
      const fIdNorm = cleanStr(landmarkFeature.id);
      const fTitleNorm = cleanStr(title);

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const rIdNorm = idIdx >= 0 ? cleanStr(r[idIdx]) : '';
        const rLandmarkNorm = landmarkIdx >= 0 ? cleanStr(r[landmarkIdx]) : '';

        if (fIdNorm && rIdNorm && rIdNorm === fIdNorm) {
          targetRowIndex = i + 1;
          break;
        }
        if (fTitleNorm && rLandmarkNorm && rLandmarkNorm === fTitleNorm) {
          targetRowIndex = i + 1;
          break;
        }
      }

      if (action === 'delete') {
        if (targetRowIndex > 1) {
          const sId = await getSheetIdByName(spreadsheetId, 'Landmarks');
          if (sId !== null) {
            await deleteSheetRowByIndex(spreadsheetId, sId, targetRowIndex - 1);
          }
        }
      } else {
        // 'update' / 'edit' / 'create' / 'add'
        if (targetRowIndex > 1) {
          await updateSheetRow(spreadsheetId, `Landmarks!A${targetRowIndex}:E${targetRowIndex}`, [landmarkSheetRow]);
        } else {
          await appendSheetRow(spreadsheetId, 'Landmarks!A:E', landmarkSheetRow);
        }
      }
    } else {
      await appendSheetRow(spreadsheetId, 'Landmarks!A:E', landmarkSheetRow);
    }
  } catch (err) {
    console.error('Failed to sync landmark to Google Sheets:', err);
    throw err;
  }
};

export const ensureSheetTabExists = async (spreadsheetId, title = 'Areas', headers = ['Parent Location', 'Secondary Location']) => {
  if (!spreadsheetId || spreadsheetId === 'default') return;

  try {
    const meta = await backendFetch('/api/sheets/metadata');
    const existingTitles = (meta.sheets || []).map(s => s.properties?.title);

    if (!existingTitles.includes(title)) {
      await backendFetch('/api/sheets/batchUpdate', {
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
        await updateSheetRow(spreadsheetId, `${title}!A1:${lastColChar}1`, [headers]);
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

  if (!spreadsheetId || spreadsheetId === 'default') return;

  try {
    await ensureSheetTabExists(spreadsheetId, 'Areas', ['Parent Location', 'Secondary Location']);
    await appendSheetRows(spreadsheetId, 'Areas!A:B', rowsToAppend);
  } catch (err) {
    console.warn('Sync for Area failed:', err);
  }
};

export const fetchAreasFromSheet = async (spreadsheetId) => {
  if (!spreadsheetId || spreadsheetId === 'default') return [];

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
  if (!spreadsheetId || spreadsheetId === 'default') return;

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
      await updateSheetRow(spreadsheetId, `${sheetName}!A1:J1`, [correctHeaders]);
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

  if (!spreadsheetId || spreadsheetId === 'default') {
    throw new Error('No Google Sheet is configured.');
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
    const partyNameVal = d.partyName || feature.partyName || '';
    const partyPhoneVal = d.partyPhone || feature.partyPhone || '';
    const brokerNameVal = d.brokerName || feature.brokerName || '';
    const brokerPhoneVal = d.brokerPhone || feature.brokerPhone || '';

    const cleanPartyName = partyNameVal.includes('[{"lat":') ? '' : partyNameVal;
    const cleanPartyPhone = partyPhoneVal.includes('[{"lat":') ? '' : partyPhoneVal;
    const cleanBrokerName = brokerNameVal.includes('[{"lat":') ? '' : brokerNameVal;
    const cleanBrokerPhone = brokerPhoneVal.includes('[{"lat":') ? '' : brokerPhoneVal;
    const center = feature.center || calculatePolygonCenter(feature.coordinates);

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
      remarksVal,
      cleanPartyName,
      cleanPartyPhone,
      cleanBrokerName,
      cleanBrokerPhone,
      feature.coordinates && feature.coordinates.length > 0 ? JSON.stringify(feature.coordinates) : '',
      center ? `${center.lat}, ${center.lng}` : '',
      d.reference || feature.reference || '',
      d.areaUnit || feature.areaUnit || ''
    ];

    let targetRowIndex = -1;

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
          await updateSheetRow(spreadsheetId, `Polygons!A${targetRowIndex}:R${targetRowIndex}`, [cleanRow]);
        } else {
          console.warn(`[syncFeatureToSheet] No matching row found in Google Sheet for polygon id="${feature.id}" (TP: ${tpVal}, FP: ${fpVal}). Skipping update to avoid creating new rows or overwriting unrelated polygons.`);
        }
      } else if (action === 'create' || action === 'add') {
        if (targetRowIndex > 1) {
          await updateSheetRow(spreadsheetId, `Polygons!A${targetRowIndex}:R${targetRowIndex}`, [cleanRow]);
        } else {
          await appendSheetRow(spreadsheetId, 'Polygons!A:R', cleanRow);
        }
      }
    }
  } catch (err) {
    console.error('[syncFeatureToSheet] FAILED:', err);
    throw err; // Re-throw so callers can handle it
  }
};

export const overwriteSheetWithFeatures = async (spreadsheetId, features = [], range = 'Polygons') => {
  const headers = ['id', 'tp', 'op', 'fp', 'area', 'location', 'parent_location', 'landmark', 'type', 'remarks', 'Party Name', 'Party Phone', 'Broker Name', 'Broker Phone', 'coordinates', 'center pin lat long', 'reference', 'area unit'];
  
  const polygonFeatures = features.filter(f => !(f.id?.startsWith('landmark-') || f.data?.type === 'Landmark'));

  const rows = [
    headers,
    ...polygonFeatures.map(f => {
      const d = f.data || {};
      const parentLoc = d.parentLocation || d.parent_location || determineParentLocation(d.location);
      const center = f.center || calculatePolygonCenter(f.coordinates);
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
        d.remarks || '',
        d.partyName || '',
        d.partyPhone || '',
        d.brokerName || '',
        d.brokerPhone || '',
        f.coordinates && f.coordinates.length > 0 ? JSON.stringify(f.coordinates) : '',
        center ? `${center.lat}, ${center.lng}` : '',
        d.reference || '',
        d.areaUnit || ''
      ];
    })
  ];

  await clearSheetData(spreadsheetId, range);

  return updateSheetRow(spreadsheetId, range, rows);
};

export const overwriteAreasSheet = async (spreadsheetId, areaRows = []) => {
  if (!spreadsheetId || spreadsheetId === 'default' || areaRows.length === 0) return;

  try {
    await ensureSheetTabExists(spreadsheetId, 'Areas', ['Parent Location', 'Secondary Location', 'Polygon IDs']);
    await clearSheetData(spreadsheetId, 'Areas!A:Z');
    await updateSheetRow(spreadsheetId, `Areas!A1:C${areaRows.length}`, areaRows);
  } catch (err) {
    console.warn('Overwrite for Areas failed:', err);
  }
};

export const overwriteLandmarksSheet = async (spreadsheetId, landmarkRows = []) => {
  if (!spreadsheetId || spreadsheetId === 'default' || landmarkRows.length === 0) return;

  const headers = ['id', 'Landmark Name', 'Latitude', 'Longitude', 'Remarks'];
  const rows = [headers, ...landmarkRows];
  const range = 'Landmarks';

  try {
    await ensureSheetTabExists(spreadsheetId, 'Landmarks', headers);
    await clearSheetData(spreadsheetId, 'Landmarks!A:Z');
    await updateSheetRow(spreadsheetId, range, rows);
  } catch (err) {
    console.warn('Overwrite for Landmarks failed:', err);
  }
};

export const fetchAndMergeSheetUpdates = async (spreadsheetId) => {
  try {
    let polygonsData = [];
    let areasData = [];
    let landmarksData = [];

    try {
      const pRes = await fetchSheetData(spreadsheetId, 'Polygons');
      if (pRes && pRes.values) polygonsData = pRes.values;

      const aRes = await fetchSheetData(spreadsheetId, 'Areas');
      if (aRes && aRes.values) areasData = aRes.values;

      const lRes = await fetchSheetData(spreadsheetId, 'Landmarks');
      if (lRes && lRes.values) landmarksData = lRes.values;
    } catch (err) {
      console.warn('Failed to fetch sheet data:', err);
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
        const syncedAreas = store.syncedAreas || [];
        
        // 1. Delete areas that were synced but missing from sheet
        syncedAreas.forEach(({ parent, secondary }) => {
          if (!loadedAreasMap[parent]) {
            delete CATEGORY_MAP[parent];
            useMapStore.setState(state => ({ customAreas: (state.customAreas || []).filter(a => a !== parent) }));
          } else if (secondary && !loadedAreasMap[parent].includes(secondary)) {
            if (CATEGORY_MAP[parent]) {
               CATEGORY_MAP[parent] = CATEGORY_MAP[parent].filter(s => s !== secondary);
            }
          }
        });

        // 2. Add areas from sheet
        Object.entries(loadedAreasMap).forEach(([pName, sList]) => {
          store.addCustomArea(pName);
          if (!CATEGORY_MAP[pName]) {
            CATEGORY_MAP[pName] = sList;
          } else {
            CATEGORY_MAP[pName] = Array.from(new Set([...(CATEGORY_MAP[pName] || []), ...sList]));
          }
        });
        
        // 3. Update syncedAreas to match exactly what we fetched
        const newSyncedAreas = [];
        Object.entries(loadedAreasMap).forEach(([pName, sList]) => {
           if (sList.length === 0) newSyncedAreas.push({ parent: pName, secondary: '' });
           else sList.forEach(s => newSyncedAreas.push({ parent: pName, secondary: s }));
        });
        useMapStore.setState({ syncedAreas: newSyncedAreas });

        // 4. Fallback cleanup: Remove stuck ghost areas from customAreas if they aren't in the sheet 
        // and aren't in the default CATEGORY_MAP, so they don't stay in the UI forever with 0 plots.
        const defaultAreas = Object.keys(await import('../config/categories.js').then(m => m.CATEGORY_MAP));
        useMapStore.setState(state => {
          const validAreas = new Set([...Object.keys(loadedAreasMap), ...defaultAreas]);
          const cleanedCustomAreas = (state.customAreas || []).filter(a => validAreas.has(a));
          return { customAreas: cleanedCustomAreas };
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
    const landmarkIdx = !isCorruptedHeaders && (rawHeaders.indexOf('landmark remarks') >= 0 ? rawHeaders.indexOf('landmark remarks') : rawHeaders.indexOf('landmark')) >= 0 ? (rawHeaders.indexOf('landmark remarks') >= 0 ? rawHeaders.indexOf('landmark remarks') : rawHeaders.indexOf('landmark')) : 7;
    const catIdx = !isCorruptedHeaders && (rawHeaders.indexOf('category') >= 0 ? rawHeaders.indexOf('category') : rawHeaders.indexOf('type')) >= 0 ? (rawHeaders.indexOf('category') >= 0 ? rawHeaders.indexOf('category') : rawHeaders.indexOf('type')) : 8;
    const remarksIdx = !isCorruptedHeaders && rawHeaders.indexOf('remarks') >= 0 ? rawHeaders.indexOf('remarks') : 9;
    const partyNameIdx = !isCorruptedHeaders && rawHeaders.indexOf('party name') >= 0 ? rawHeaders.indexOf('party name') : 10;
    const partyPhoneIdx = !isCorruptedHeaders && rawHeaders.indexOf('party phone') >= 0 ? rawHeaders.indexOf('party phone') : 11;
    const brokerNameIdx = !isCorruptedHeaders && rawHeaders.indexOf('broker name') >= 0 ? rawHeaders.indexOf('broker name') : 12;
    const brokerPhoneIdx = !isCorruptedHeaders && rawHeaders.indexOf('broker phone') >= 0 ? rawHeaders.indexOf('broker phone') : 13;
    const coordsIdx = !isCorruptedHeaders && rawHeaders.indexOf('coordinates') >= 0 ? rawHeaders.indexOf('coordinates') : 14;
    const referenceIdx = !isCorruptedHeaders && rawHeaders.indexOf('reference') >= 0 ? rawHeaders.indexOf('reference') : 16;
    const areaUnitIdx = !isCorruptedHeaders && rawHeaders.indexOf('area unit') >= 0 ? rawHeaders.indexOf('area unit') : 17;

    const sheetMap = new Map();
    for (let i = 1; i < polygonsData.length; i++) {
      const row = polygonsData[i];
      if (!Array.isArray(row)) continue;
      const id = idIdx >= 0 ? String(row[idIdx] || '').trim() : '';
      const tp = tpIdx >= 0 ? String(row[tpIdx] || '').trim() : '';
      const fp = fpIdx >= 0 ? String(row[fpIdx] || '').trim() : '';

      let loc = locIdx >= 0 ? String(row[locIdx] || '').trim() : '';
      let pLoc = parentLocIdx >= 0 ? String(row[parentLocIdx] || '').trim() : '';

      const customAreas = useMapStore.getState().customAreas || [];
      const allParentLocations = Array.from(new Set([...Object.keys(CATEGORY_MAP), ...customAreas]));

      const lowerAllParentLocs = allParentLocations.map(l => l.toLowerCase());
      if (pLoc && !lowerAllParentLocs.includes(pLoc.toLowerCase())) {
         if (!loc || loc.toLowerCase() === pLoc.toLowerCase()) loc = pLoc;
         else loc = `${pLoc}, ${loc}`;
         pLoc = 'Surat';
      } else if (!pLoc) {
         pLoc = determineParentLocation(loc);
      }

      if (pLoc && pLoc.toLowerCase() !== 'surat') {
        loc = pLoc;
      }

      const rawPartyName = partyNameIdx >= 0 ? String(row[partyNameIdx] || '').trim() : '';
      const rawPartyPhone = partyPhoneIdx >= 0 ? String(row[partyPhoneIdx] || '').trim() : '';
      const rawBrokerName = brokerNameIdx >= 0 ? String(row[brokerNameIdx] || '').trim() : '';
      const rawBrokerPhone = brokerPhoneIdx >= 0 ? String(row[brokerPhoneIdx] || '').trim() : '';

      const rowData = {
        id, tp, op: opIdx >= 0 ? String(row[opIdx] || '').trim() : '', fp,
        area: areaIdx >= 0 ? String(row[areaIdx] || '').trim() : '',
        location: loc,
        parentLocation: pLoc,
        landmark: landmarkIdx >= 0 ? String(row[landmarkIdx] || '').trim() : '',
        type: catIdx >= 0 ? String(row[catIdx] || '').trim() : '',
        remarks: remarksIdx >= 0 ? String(row[remarksIdx] || '').trim() : '',
        partyName: rawPartyName.includes('[{"lat":') ? '' : rawPartyName,
        partyPhone: rawPartyPhone.includes('[{"lat":') ? '' : rawPartyPhone,
        brokerName: rawBrokerName.includes('[{"lat":') ? '' : rawBrokerName,
        brokerPhone: rawBrokerPhone.includes('[{"lat":') ? '' : rawBrokerPhone,
        coordinates: coordsIdx >= 0 ? String(row[coordsIdx] || '').trim() : '',
        reference: referenceIdx >= 0 ? String(row[referenceIdx] || '').trim() : '',
        areaUnit: areaUnitIdx >= 0 ? String(row[areaUnitIdx] || '').trim() : ''
      };

      if (id) sheetMap.set(`id:${id}`, rowData);
      if (tp || fp) sheetMap.set(`tpfp:${tp}_${fp}`, rowData);
    }

    // Process Landmarks (5 columns: id, Landmark Name, Latitude, Longitude, Remarks)
    if (landmarksData && landmarksData.length > 1) {
      const lHeaders = landmarksData[0].map(h => String(h || '').trim().toLowerCase());
      const lIdIdx = lHeaders.indexOf('id') >= 0 ? lHeaders.indexOf('id') : 0;
      const lNameIdx = lHeaders.indexOf('landmark name') >= 0 ? lHeaders.indexOf('landmark name') : 1;
      const lLatIdx = lHeaders.indexOf('latitude') >= 0 ? lHeaders.indexOf('latitude') : 2;
      const lLngIdx = lHeaders.indexOf('longitude') >= 0 ? lHeaders.indexOf('longitude') : 3;
      const lRemarksIdx = lHeaders.indexOf('remarks') >= 0 ? lHeaders.indexOf('remarks') : 4;

      for (let i = 1; i < landmarksData.length; i++) {
        const row = landmarksData[i];
        if (!Array.isArray(row)) continue;
        const id = lIdIdx >= 0 ? String(row[lIdIdx] || '').trim() : '';
        if (id) {
          const lName = lNameIdx >= 0 ? String(row[lNameIdx] || '').trim() : '';

          if (sheetMap.has(`id:${id}`)) {
             sheetMap.get(`id:${id}`).landmark = lName;
             continue;
          }
          sheetMap.set(`id:${id}`, {
            id,
            name: lName,
            landmark: lName,
            lat: lLatIdx >= 0 ? String(row[lLatIdx] || '').trim() : '',
            lng: lLngIdx >= 0 ? String(row[lLngIdx] || '').trim() : '',
            remarks: lRemarksIdx >= 0 ? String(row[lRemarksIdx] || '').trim() : '',
            type: 'Landmark'
          });
        }
      }
    }

    let deleteCount = 0;
    const updatedFeatures = currentFeatures.filter(f => {
      const d = f.data || {};
      const lookupTp = d.tp != null ? String(d.tp).trim() : '';
      const lookupFp = d.fp != null ? String(d.fp).trim() : '';
      let sheetMatch = sheetMap.get(`id:${f.id}`);
      if (!sheetMatch && (lookupTp || lookupFp)) {
        sheetMatch = sheetMap.get(`tpfp:${lookupTp}_${lookupFp}`);
      }
      if (!sheetMatch) {
        // Never delete locally-drawn features — they may not yet be in the sheet or the ID lookup may fail
        if (f.source === 'drawn') return true;
        if (f.syncStatus === 'synced') {
          console.log(`Removing deleted feature: ${f.id}`);
          deleteCount++;
          return false;
        }
        return true;
      }
      return true;
    }).map(f => {
      const d = f.data || {};
      const lookupTp = d.tp != null ? String(d.tp).trim() : '';
      const lookupFp = d.fp != null ? String(d.fp).trim() : '';
      let sheetMatch = sheetMap.get(`id:${f.id}`);
      if (!sheetMatch && (lookupTp || lookupFp)) {
        sheetMatch = sheetMap.get(`tpfp:${lookupTp}_${lookupFp}`);
      }
      if (!sheetMatch) return f;
      
      sheetMatch.processed = true; // Mark as processed
      
      const isLandmarkType = f.id?.startsWith('landmark-') || d.type === 'Landmark';

      if (isLandmarkType) {
        const localName = String(d.name || d.landmark || '').trim();
        const localRemarks = String(d.remarks || '').trim();

        const nameChanged = sheetMatch.name && sheetMatch.name !== localName;
        const remarksChanged = sheetMatch.remarks && sheetMatch.remarks !== localRemarks;

        if (nameChanged || remarksChanged) {
          updateCount++;
          return {
            ...f,
            syncStatus: 'synced',
            data: {
              ...d,
              name: sheetMatch.name || localName,
              landmark: sheetMatch.name || localName,
              remarks: sheetMatch.remarks || localRemarks
            }
          };
        }
      } else {
        const localTp = String(d.tp || '').trim();
        const localOp = String(d.op || '').trim();
        const localFp = String(d.fp || '').trim();
        const localArea = String(d.area || '').trim();
        const localLoc = String(d.location || '').trim();
        const localLandmark = String(d.landmark || '').trim();
        const localType = String(d.type || '').trim();
        const localRemarks = String(d.remarks || '').trim();
        const localPartyName = String(d.partyName || '').trim();
        const localPartyPhone = String(d.partyPhone || '').trim();
        const localBrokerName = String(d.brokerName || '').trim();
        const localBrokerPhone = String(d.brokerPhone || '').trim();

        const tpChanged = sheetMatch.tp && sheetMatch.tp !== localTp;
        const opChanged = sheetMatch.op && sheetMatch.op !== localOp;
        const fpChanged = sheetMatch.fp && sheetMatch.fp !== localFp;
        const areaChanged = sheetMatch.area && sheetMatch.area !== localArea;
        const locChanged = sheetMatch.location && sheetMatch.location !== localLoc;
        const landmarkChanged = sheetMatch.landmark && sheetMatch.landmark !== localLandmark;
        const typeChanged = sheetMatch.type && sheetMatch.type !== localType;
        const remarksChanged = sheetMatch.remarks && sheetMatch.remarks !== localRemarks;
        const partyNameChanged = sheetMatch.partyName && sheetMatch.partyName !== localPartyName;
        const partyPhoneChanged = sheetMatch.partyPhone && sheetMatch.partyPhone !== localPartyPhone;
        const brokerNameChanged = sheetMatch.brokerName && sheetMatch.brokerName !== localBrokerName;
        const brokerPhoneChanged = sheetMatch.brokerPhone && sheetMatch.brokerPhone !== localBrokerPhone;

        if (tpChanged || opChanged || fpChanged || areaChanged || locChanged || landmarkChanged || typeChanged || remarksChanged || partyNameChanged || partyPhoneChanged || brokerNameChanged || brokerPhoneChanged) {
          if (f.syncStatus === 'edited') return f;
          updateCount++;
          const newType = sheetMatch.type || localType;
          const newColor = getPropertyTypeColor(newType);
          return {
            ...f,
            syncStatus: 'synced',
            data: {
              ...d,
              tp: sheetMatch.tp || localTp,
              op: sheetMatch.op || localOp,
              fp: sheetMatch.fp || localFp,
              area: sheetMatch.area || localArea,
              location: sheetMatch.location || localLoc,
              parentLocation: sheetMatch.parentLocation || determineParentLocation(sheetMatch.location || localLoc),
              landmark: sheetMatch.landmark || localLandmark,
              type: newType,
              remarks: sheetMatch.remarks || localRemarks,
              partyName: sheetMatch.partyName || localPartyName,
              partyPhone: sheetMatch.partyPhone || localPartyPhone,
              brokerName: sheetMatch.brokerName || localBrokerName,
              brokerPhone: sheetMatch.brokerPhone || localBrokerPhone,
              reference: sheetMatch.reference || d.reference || '',
              areaUnit: sheetMatch.areaUnit || d.areaUnit || ''
            },
            style: {
              ...f.style,
              fillColor: newColor,
              strokeColor: newColor
            }
          };
        }
      }
      if (f.syncStatus !== 'synced') {
        updateCount++;
        return { ...f, syncStatus: 'synced' };
      }
      return f;
    });

    const newFeaturesToImport = [];
    for (const [key, sheetMatch] of sheetMap.entries()) {
      // Only process the id entries to avoid duplicates from tpfp entries, and only if not processed
      if (key.startsWith('id:') && !sheetMatch.processed && sheetMatch.coordinates) {
        try {
          const parsedCoordinates = JSON.parse(sheetMatch.coordinates);
          // Filter out any null/undefined elements and ensure proper {lat, lng} format
          const validCoordinates = Array.isArray(parsedCoordinates)
            ? parsedCoordinates.filter(c => c && typeof c.lat !== 'undefined' && typeof c.lng !== 'undefined')
            : [];
          if (validCoordinates.length >= 3) {
            const newColor = getPropertyTypeColor(sheetMatch.type || 'Freehold');
            
            // Calculate center
            let bounds = new window.google.maps.LatLngBounds();
            validCoordinates.forEach(c => bounds.extend(new window.google.maps.LatLng(c.lat, c.lng)));
            const center = { lat: bounds.getCenter().lat(), lng: bounds.getCenter().lng() };
            
            newFeaturesToImport.push({
              id: sheetMatch.id,
              source: 'drawn',
              type: 'polygon',
              coordinates: validCoordinates,
              center,
              syncStatus: 'synced',
              data: {
                tp: sheetMatch.tp,
                op: sheetMatch.op,
                fp: sheetMatch.fp,
                area: sheetMatch.area,
                location: sheetMatch.location,
                parentLocation: sheetMatch.parentLocation,
                landmark: sheetMatch.landmark,
                type: sheetMatch.type || 'Freehold',
                remarks: sheetMatch.remarks,
                reference: sheetMatch.reference || '',
                areaUnit: sheetMatch.areaUnit || ''
              },
              style: {
                fillColor: newColor,
                fillOpacity: 0.4,
                strokeColor: newColor,
                strokeWeight: 2,
                visible: true
              }
            });
            updateCount++;
          }
        } catch (err) {
          console.warn('Failed to parse coordinates for new feature from sheet:', sheetMatch.id, err);
        }
      } else if (key.startsWith('id:') && !sheetMatch.processed && sheetMatch.type === 'Landmark') {
        const lat = parseFloat(sheetMatch.lat);
        const lng = parseFloat(sheetMatch.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
          newFeaturesToImport.push({
            id: sheetMatch.id,
            source: 'drawn',
            type: 'marker',
            position: { lat, lng },
            syncStatus: 'synced',
            data: {
              name: sheetMatch.name || sheetMatch.landmark || '',
              landmark: sheetMatch.landmark || sheetMatch.name || '',
              type: 'Landmark',
              remarks: sheetMatch.remarks || ''
            },
            style: {
              color: '#64748b',
              visible: true
            }
          });
          updateCount++;
        }
      }
    }

    if (updateCount > 0 || deleteCount > 0) {
      useMapStore.getState().setFeatures([...updatedFeatures, ...newFeaturesToImport]);
    }

    return updateCount + deleteCount;
  } catch (err) {
    console.error('Failed to sync Google Sheets updates to Map Editor:', err);
    return 0;
  }
};
