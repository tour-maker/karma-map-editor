import { determineParentLocation, getPropertyTypeColor, CATEGORY_MAP } from '../config/categories.js';
import { useMapStore } from '../store/useMapStore.js';
import { calculatePolygonCenter } from './googleMaps.js';
import { API_BASE_URL } from '../config/api.js';

let tokenClient = null;
let accessToken = null;
let _autoRefreshTimer = null;
let _onTokenResponseCallback = null;

// Human-readable "last updated" stamp, in IST, e.g. "Sep 24, 2026, 05:17 PM"
// (this is purely for people reading the sheet — nothing elsewhere parses it
// back into a Date, it's only ever re-displayed as-is).
const formatTimestamp = (date = new Date()) => new Intl.DateTimeFormat('en-US', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: true,
  timeZone: 'Asia/Kolkata'
}).format(date);

const normalizeSheetId = value => String(value || '').trim().toLowerCase();
const normalizeParcelNumber = value => String(value || '')
  .trim()
  .replace(/^(tp|op|fp)[:\s]*/i, '')
  .toLowerCase()
  .replace(/\s+/g, ' ');

const polygonCoordinatesKey = value => {
  let coordinates = value;
  if (typeof coordinates === 'string') {
    try {
      coordinates = JSON.parse(coordinates);
    } catch {
      return '';
    }
  }
  if (!Array.isArray(coordinates) || coordinates.length < 3) return '';
  return JSON.stringify(coordinates.map(point => [Number(point?.lat), Number(point?.lng)]));
};

const addUniqueSheetMatch = (map, key, row) => {
  if (!key) return;
  if (map.has(key)) map.set(key, null);
  else map.set(key, row);
};

const hasUniqueSheetId = (sheetMap, row) =>
  Boolean(row?.id) && sheetMap.get(`id:${normalizeSheetId(row.id)}`) === row;

const findPolygonSheetMatch = (sheetMap, feature) => {
  if (feature.isNew) {
    const geometryKey = polygonCoordinatesKey(feature.coordinates);
    return geometryKey ? sheetMap.get(`geometry:${geometryKey}`) || null : null;
  }

  const id = normalizeSheetId(feature.id);
  if (id && sheetMap.has(`id:${id}`)) return sheetMap.get(`id:${id}`);

  const data = feature.data || {};
  const tp = normalizeParcelNumber(data.tp ?? feature.tp);
  const op = normalizeParcelNumber(data.op ?? feature.op);
  const fp = normalizeParcelNumber(data.fp ?? feature.fp);
  if (tp && op && fp) {
    const match = sheetMap.get(`tpopfp:${JSON.stringify([tp, op, fp])}`);
    if (match) return match;
  }
  if (tp && fp && !op) {
    return sheetMap.get(`tpfp:${JSON.stringify([tp, fp])}`) || null;
  }
  return null;
};

const hasAmbiguousPolygonSheetMatch = (sheetMap, feature) => {
  if (feature.isNew) {
    const geometryKey = polygonCoordinatesKey(feature.coordinates);
    const key = geometryKey ? `geometry:${geometryKey}` : '';
    return Boolean(key && sheetMap.has(key) && sheetMap.get(key) === null);
  }

  const id = normalizeSheetId(feature.id);
  if (id && sheetMap.has(`id:${id}`)) return sheetMap.get(`id:${id}`) === null;

  const data = feature.data || {};
  const tp = normalizeParcelNumber(data.tp ?? feature.tp);
  const op = normalizeParcelNumber(data.op ?? feature.op);
  const fp = normalizeParcelNumber(data.fp ?? feature.fp);
  const key = tp && op && fp
    ? `tpopfp:${JSON.stringify([tp, op, fp])}`
    : tp && fp && !op
      ? `tpfp:${JSON.stringify([tp, fp])}`
      : '';
  return Boolean(key && sheetMap.has(key) && sheetMap.get(key) === null);
};

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
const BACKEND_URL = API_BASE_URL;

const adminAuthHeaders = () => {
  const jwt = sessionStorage.getItem('karmaAdminJWT');
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
    const error = new Error(err.error || 'Sheets backend error');
    error.status = response.status;
    throw error;
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
    const headers = rows[0]?.map(h => String(h || '').trim().toLowerCase()) || [];
    const idIdx = headers.indexOf('id') >= 0 ? headers.indexOf('id') : 0;
    const landmarkIdx = headers.indexOf('landmark name') >= 0 ? headers.indexOf('landmark name') : 1;
    const cleanStr = val => String(val || '').toLowerCase().trim();
    const isCreate = action === 'create' || action === 'add';
    const fIdNorm = isCreate ? '' : cleanStr(landmarkFeature.id);
    const fTitleNorm = cleanStr(title);

    for (let i = 1; i < rows.length; i++) {
      const rowId = cleanStr(rows[i]?.[idIdx]);
      const rowTitle = cleanStr(rows[i]?.[landmarkIdx]);
      if ((fIdNorm && rowId === fIdNorm) || (fTitleNorm && rowTitle === fTitleNorm)) {
        targetRowIndex = i + 1;
        break;
      }
    }

    const maxLandmarkNumber = rows.slice(1).reduce((max, row) => {
      const match = String(row?.[idIdx] || '').trim().match(/^lm(\d+)$/i);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    const existingRowId = targetRowIndex > 1 ? String(rows[targetRowIndex - 1]?.[idIdx] || '').trim() : '';
    landmarkSheetRow[0] = existingRowId || `lm${maxLandmarkNumber + 1}`;

    if (action === 'delete') {
      if (targetRowIndex > 1) {
        const sId = await getSheetIdByName(spreadsheetId, 'Landmarks');
        if (sId !== null) {
          await deleteSheetRowByIndex(spreadsheetId, sId, targetRowIndex - 1);
        }
      }
    } else if (targetRowIndex > 1) {
      await updateSheetRow(spreadsheetId, `Landmarks!A${targetRowIndex}:E${targetRowIndex}`, [landmarkSheetRow]);
    } else {
      await appendSheetRow(spreadsheetId, 'Landmarks!A:E', landmarkSheetRow);
    }

    return landmarkSheetRow[0];
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
    // Re-throw so callers (AddAreaModal) can tell the user the save did NOT reach the sheet.
    throw err;
  }
};

// Edits the "Areas" tab: removes rows (a pair with a secondary removes just that row;
// a pair with an empty secondary removes EVERY row of that parent) and then appends new
// pairs that are not already present. Rows are deleted bottom-up in ONE batchUpdate, so
// nothing is cleared-then-rewritten and a failure cannot wipe the tab.
export const updateAreasSheet = async (spreadsheetId, { remove = [], add = [] } = {}) => {
  if (!spreadsheetId || spreadsheetId === 'default') return;
  const norm = (v) => String(v || '').trim().toLowerCase();

  await ensureSheetTabExists(spreadsheetId, 'Areas', ['Parent Location', 'Secondary Location']);
  const sheetData = await fetchSheetData(spreadsheetId, 'Areas!A:B');
  const rows = sheetData.values || [];

  const toDelete = [];
  const kept = [];
  rows.forEach((row, idx) => {
    const parent = norm(row?.[0]);
    const secondary = norm(row?.[1]);
    const isHeader = idx === 0 && parent === 'parent location';
    const matches = !isHeader && remove.some(r =>
      norm(r.parent) === parent && (!norm(r.secondary) || norm(r.secondary) === secondary)
    );
    if (matches) toDelete.push(idx);
    else if (!isHeader && parent) kept.push(`${parent}||${secondary}`);
  });

  if (toDelete.length > 0) {
    const areasSheetId = await getSheetIdByName(spreadsheetId, 'Areas');
    if (areasSheetId == null) throw new Error('Could not find the Areas tab in the sheet');
    await backendFetch('/api/sheets/batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: toDelete.sort((a, b) => b - a).map(rowIndex => ({
          deleteDimension: { range: { sheetId: areasSheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 } }
        }))
      }),
    });
  }

  const seen = new Set(kept);
  const rowsToAppend = [];
  add.forEach(({ parent, secondary = '' }) => {
    const p = String(parent || '').trim();
    if (!p) return;
    const sec = String(secondary || '').trim();
    const key = `${norm(p)}||${norm(sec)}`;
    if (seen.has(key)) return;
    seen.add(key);
    rowsToAppend.push([p, sec]);
  });
  if (rowsToAppend.length > 0) {
    await ensureSheetTabExists(spreadsheetId, 'Areas', ['Parent Location', 'Secondary Location']);
    await appendSheetRows(spreadsheetId, 'Areas!A:B', rowsToAppend);
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

/**
 * Wraps an async sync call with retry + backoff logic.
 * Attempts up to `retries` total tries, waiting `delayMs * attempt` between
 * each failed attempt. Re-throws the last error if every attempt fails, so
 * callers can rely on a thrown error meaning "sync did NOT succeed" even
 * after retrying.
 */
export const withSyncRetry = async (fn, { retries = 3, delayMs = 700 } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Retrying an auth failure can never succeed and only keeps the user waiting.
      if (err?.status === 401) throw err;
      console.warn(`[withSyncRetry] Attempt ${attempt}/${retries} failed:`, err?.message || err);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw lastError;
};

// Rewrites the "type" column for every Polygons row whose type satisfies `matches`, in ONE read and
// ONE write (a per-plot sync would need one read per plot and hit Google's quota on a big category).
// Returns how many rows changed.
export const renameTypeInSheet = async (spreadsheetId, matches, newType) => {
  if (!spreadsheetId || spreadsheetId === 'default') throw new Error('No Google Sheet is configured.');
  const sheetData = await fetchSheetData(spreadsheetId, 'Polygons');
  const rows = sheetData.values || [];
  if (rows.length < 2) return 0;
  const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
  const typeIdx = headers.indexOf('type') >= 0 ? headers.indexOf('type') : 8;
  let changed = 0;
  const column = rows.slice(1).map(row => {
    const value = row[typeIdx] ?? '';
    if (value && matches(value)) { changed += 1; return [newType]; }
    return [value];
  });
  if (changed === 0) return 0;
  const letter = String.fromCharCode(65 + typeIdx);
  await updateSheetRow(spreadsheetId, `Polygons!${letter}2:${letter}${rows.length}`, column);
  return changed;
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
    const loc = d.location ?? feature.location ?? '';
    const parentLoc = d.parentLocation ?? d.parent_location ?? feature.parentLocation ?? determineParentLocation(loc) ?? '';
    const tpVal = d.tp ?? feature.tp ?? '';
    const opVal = d.op ?? feature.op ?? '';
    const fpVal = d.fp ?? feature.fp ?? '';
    const areaVal = d.area != null ? d.area : (feature.area != null ? feature.area : '');
    const landmarkVal = d.landmark ?? feature.landmark ?? '';
    const typeVal = d.type ?? feature.type ?? '';
    const remarksVal = d.remarks ?? feature.remarks ?? '';
    const partyNameVal = d.partyName ?? feature.partyName ?? '';
    const partyPhoneVal = d.partyPhone ?? feature.partyPhone ?? '';
    const brokerNameVal = d.brokerName ?? feature.brokerName ?? '';
    const brokerPhoneVal = d.brokerPhone ?? feature.brokerPhone ?? '';

    const cleanPartyName = partyNameVal.includes('[{"lat":') ? '' : partyNameVal;
    const cleanPartyPhone = partyPhoneVal.includes('[{"lat":') ? '' : partyPhoneVal;
    const cleanBrokerName = brokerNameVal.includes('[{"lat":') ? '' : brokerNameVal;
    const cleanBrokerPhone = brokerPhoneVal.includes('[{"lat":') ? '' : brokerPhoneVal;
    const center = feature.center || calculatePolygonCenter(feature.coordinates);

    let cleanRow = [
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
      d.areaUnit ?? feature.areaUnit ?? '',
      formatTimestamp()
    ];

    let targetRowIndex = -1;

    await repairSheet1Headers(spreadsheetId, 'Polygons');
    const sheetData = await fetchSheetData(spreadsheetId, 'Polygons');
    let rows = sheetData.values || [];
    if (rows.length === 0) {
      const headers = ['id', 'tp', 'op', 'fp', 'area', 'location', 'parent_location', 'landmark', 'type', 'remarks', 'Party Name', 'Party Phone', 'Broker Name', 'Broker Phone', 'coordinates', 'center pin lat long', 'reference', 'area unit', 'last updated'];
      await updateSheetRow(spreadsheetId, 'Polygons!A1:S1', [headers]);
      rows = [headers];
    }
    if (rows.length > 0) {
      // Label column S if it's missing, so the new timestamp isn't a headerless column
      const existingS1 = String((rows[0][18] || '')).trim().toLowerCase();
      if (existingS1 !== 'last updated') {
        await updateSheetRow(spreadsheetId, 'Polygons!S1', [['last updated']]);
      }
      const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
      const idIdx = headers.indexOf('id') >= 0 ? headers.indexOf('id') : 0;
      const tpIdx = headers.indexOf('tp') >= 0 ? headers.indexOf('tp') : 1;
      const opIdx = headers.indexOf('op') >= 0 ? headers.indexOf('op') : 2;
      const fpIdx = headers.indexOf('fp') >= 0 ? headers.indexOf('fp') : 3;
      const coordinatesIdx = headers.indexOf('coordinates') >= 0 ? headers.indexOf('coordinates') : 14;

      const fIdNorm = normalizeSheetId(feature.id);
      const fTpNorm = normalizeParcelNumber(tpVal);
      const fOpNorm = normalizeParcelNumber(opVal);
      const fFpNorm = normalizeParcelNumber(fpVal);
      const dataRows = rows.slice(1);
      const isNewFeature = feature.isNew === true;

      const uniqueRowMatch = (matches, keyDescription) => {
        if (matches.length > 1) {
          throw new Error(`Cannot safely ${action} polygon: ${keyDescription} matches multiple Google Sheet rows.`);
        }
        return matches.length === 1 ? matches[0].index + 2 : -1;
      };

      if (isNewFeature) {
        const geometryKey = polygonCoordinatesKey(feature.coordinates);
        if (!geometryKey) throw new Error('Cannot safely save a new polygon without valid coordinates.');
        targetRowIndex = uniqueRowMatch(
          dataRows.map((row, index) => ({ row, index })).filter(({ row }) =>
            polygonCoordinatesKey(row?.[coordinatesIdx]) === geometryKey
          ),
          'polygon coordinates'
        );
      } else if (fIdNorm) {
        targetRowIndex = uniqueRowMatch(
          dataRows.map((row, index) => ({ row, index })).filter(({ row }) => normalizeSheetId(row?.[idIdx]) === fIdNorm),
          `ID "${feature.id}"`
        );
      }

      // Use parcel fields only as a legacy fallback, and only when they identify
      // exactly one row. Never fall back to TP+FP when an OP was supplied.
      if (!isNewFeature && targetRowIndex < 0 && fTpNorm && fOpNorm && fFpNorm) {
        targetRowIndex = uniqueRowMatch(
          dataRows.map((row, index) => ({ row, index })).filter(({ row }) =>
            normalizeParcelNumber(row?.[tpIdx]) === fTpNorm &&
            normalizeParcelNumber(row?.[opIdx]) === fOpNorm &&
            normalizeParcelNumber(row?.[fpIdx]) === fFpNorm
          ),
          `TP/OP/FP (${tpVal}/${opVal}/${fpVal})`
        );
      } else if (!isNewFeature && targetRowIndex < 0 && fTpNorm && fFpNorm && !fOpNorm) {
        targetRowIndex = uniqueRowMatch(
          dataRows.map((row, index) => ({ row, index })).filter(({ row }) =>
            normalizeParcelNumber(row?.[tpIdx]) === fTpNorm &&
            normalizeParcelNumber(row?.[fpIdx]) === fFpNorm
          ),
          `TP/FP (${tpVal}/${fpVal})`
        );
      }

      const unitPrefix = /wingha|vingha|vigha/i.test(String(d.areaUnit || feature.areaUnit || '')) ? 'w' : 's';
      const existingId = targetRowIndex > 1 ? String(rows[targetRowIndex - 1]?.[idIdx] || '').trim() : '';
      const existingIdMatchesUnit = new RegExp(`^${unitPrefix}\\d+$`, 'i').test(existingId) &&
        rows.slice(1).filter(row => normalizeSheetId(row?.[idIdx]) === normalizeSheetId(existingId)).length === 1;
      if (action === 'create' || action === 'add' || (targetRowIndex > 1 && !existingIdMatchesUnit)) {
        const maxId = rows.slice(1).reduce((max, row) => {
          const match = String(row?.[idIdx] || '').trim().match(/^([sw])(\d+)$/i);
          return match && match[1].toLowerCase() === unitPrefix ? Math.max(max, Number(match[2])) : max;
        }, 0);
        cleanRow[0] = existingIdMatchesUnit ? existingId : `${unitPrefix}${maxId + 1}`;
      } else if (targetRowIndex > 1) {
        cleanRow[0] = existingId;
      }

      // Strictly execute action: ONLY touch the targeted row if updating
      if (action === 'delete') {
        if (targetRowIndex <= 1) throw new Error(`Cannot safely delete polygon "${feature.id}": no unique matching sheet row was found.`);
        const sId = await getSheetIdByName(spreadsheetId, 'Polygons');
        if (sId === null) throw new Error('Cannot safely delete polygon: the Polygons sheet was not found.');
        await deleteSheetRowByIndex(spreadsheetId, sId, targetRowIndex - 1);
      } else if (action === 'update' || action === 'edit' || action === 'save') {
        if (targetRowIndex > 1) {
          // Update ONLY the specific matched row
          await updateSheetRow(spreadsheetId, `Polygons!A${targetRowIndex}:S${targetRowIndex}`, [cleanRow]);
        } else {
          throw new Error(`Cannot safely update polygon "${feature.id}": no unique matching sheet row was found.`);
        }
      } else if (action === 'create' || action === 'add') {
        if (targetRowIndex > 1) {
          await updateSheetRow(spreadsheetId, `Polygons!A${targetRowIndex}:S${targetRowIndex}`, [cleanRow]);
        } else {
          await appendSheetRow(spreadsheetId, 'Polygons!A:S', cleanRow);
        }
      }
    }
    return cleanRow[0];
  } catch (err) {
    console.error('[syncFeatureToSheet] FAILED:', err);
    throw err; // Re-throw so callers can handle it
  }
};

export const overwriteSheetWithFeatures = async (spreadsheetId, features = [], range = 'Polygons') => {
  const headers = ['id', 'tp', 'op', 'fp', 'area', 'location', 'parent_location', 'landmark', 'type', 'remarks', 'Party Name', 'Party Phone', 'Broker Name', 'Broker Phone', 'coordinates', 'center pin lat long', 'reference', 'area unit', 'last updated'];

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
        d.areaUnit || '',
        // Preserve an existing timestamp on overwrite instead of stamping every row "now"
        d.lastUpdated || formatTimestamp()
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
    } catch (err) {
      console.warn('Failed to fetch Polygons sheet:', err);
      throw err;
    }

    try {
      const aRes = await fetchSheetData(spreadsheetId, 'Areas');
      if (aRes && aRes.values) areasData = aRes.values;
    } catch (err) {
      console.warn('Failed to fetch optional Areas sheet:', err);
    }

    try {
      const lRes = await fetchSheetData(spreadsheetId, 'Landmarks');
      if (lRes && lRes.values) landmarksData = lRes.values;
    } catch (err) {
      console.warn('Failed to fetch optional Landmarks sheet:', err);
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
    const lastUpdatedIdx = !isCorruptedHeaders && rawHeaders.indexOf('last updated') >= 0 ? rawHeaders.indexOf('last updated') : 18;

    const sheetMap = new Map();
    const pendingPolygonGeometryKeys = new Set(currentFeatures
      .filter(feature => feature.isNew)
      .map(feature => polygonCoordinatesKey(feature.coordinates))
      .filter(Boolean));
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

      // "Unassigned" is the holding place for plots that lost their city; it is never in the
      // Areas tab, but it must stay a city of its own instead of being folded under Surat.
      const lowerAllParentLocs = [...allParentLocations.map(l => l.toLowerCase()), 'unassigned'];
      if (pLoc && !lowerAllParentLocs.includes(pLoc.toLowerCase())) {
         if (!loc || loc.toLowerCase() === pLoc.toLowerCase()) loc = pLoc;
         else loc = `${pLoc}, ${loc}`;
         pLoc = 'Surat';
      } else if (!pLoc) {
         pLoc = determineParentLocation(loc);
      }

      if (pLoc && pLoc.toLowerCase() !== 'surat' && !loc) {
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
        areaUnit: areaUnitIdx >= 0 ? String(row[areaUnitIdx] || '').trim() : '',
        lastUpdated: lastUpdatedIdx >= 0 ? String(row[lastUpdatedIdx] || '').trim() : ''
      };

      if (id) addUniqueSheetMatch(sheetMap, `id:${normalizeSheetId(id)}`, rowData);
      const normalizedTp = normalizeParcelNumber(tp);
      const normalizedOp = normalizeParcelNumber(rowData.op);
      const normalizedFp = normalizeParcelNumber(fp);
      if (normalizedTp && normalizedOp && normalizedFp) {
        addUniqueSheetMatch(sheetMap, `tpopfp:${JSON.stringify([normalizedTp, normalizedOp, normalizedFp])}`, rowData);
      }
      if (normalizedTp && normalizedFp) {
        addUniqueSheetMatch(sheetMap, `tpfp:${JSON.stringify([normalizedTp, normalizedFp])}`, rowData);
      }
      const geometryKey = pendingPolygonGeometryKeys.size ? polygonCoordinatesKey(rowData.coordinates) : '';
      if (geometryKey && pendingPolygonGeometryKeys.has(geometryKey)) {
        addUniqueSheetMatch(sheetMap, `geometry:${geometryKey}`, rowData);
      }
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

          const existingPolygonRow = sheetMap.get(`id:${normalizeSheetId(id)}`);
          if (existingPolygonRow) {
             existingPolygonRow.landmark = lName;
             continue;
          }
          addUniqueSheetMatch(sheetMap, `id:${normalizeSheetId(id)}`, {
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
      const sheetMatch = findPolygonSheetMatch(sheetMap, f);
      if (!sheetMatch) {
        if (hasAmbiguousPolygonSheetMatch(sheetMap, f)) return true;
        if (f.syncStatus === 'pending' || f.syncStatus === 'error') return true;
        // Keep features without a completed sheet sync or a reliable row match.
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
      const sheetMatch = findPolygonSheetMatch(sheetMap, f);
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
        const localAreaUnit = String(d.areaUnit || '').trim();

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
        const areaUnitChanged = sheetMatch.areaUnit && sheetMatch.areaUnit !== localAreaUnit;

        if (tpChanged || opChanged || fpChanged || areaChanged || locChanged || landmarkChanged || typeChanged || remarksChanged || partyNameChanged || partyPhoneChanged || brokerNameChanged || brokerPhoneChanged || areaUnitChanged) {
          // Do not let a polling response overwrite a local edit while its sheet
          // write is in flight. The save handler marks it synced when the write ends.
          if (f.isNew && f.syncStatus === 'pending' && hasUniqueSheetId(sheetMap, sheetMatch)) {
            updateCount++;
            if (useMapStore.getState().selectedFeatureId === f.id) {
              useMapStore.getState().setSelectedFeatureId(sheetMatch.id);
            }
            return { ...f, id: sheetMatch.id, isNew: false, syncStatus: 'synced', instances: undefined };
          }
          if (f.syncStatus === 'edited' || f.syncStatus === 'pending') return f;
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
              areaUnit: sheetMatch.areaUnit || d.areaUnit || '',
              lastUpdated: sheetMatch.lastUpdated || d.lastUpdated || ''
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
        if (f.isNew && hasUniqueSheetId(sheetMap, sheetMatch)) {
          if (useMapStore.getState().selectedFeatureId === f.id) {
            useMapStore.getState().setSelectedFeatureId(sheetMatch.id);
          }
          return { ...f, id: sheetMatch.id, isNew: false, syncStatus: 'synced', instances: undefined };
        }
        return { ...f, syncStatus: 'synced' };
      }
      return f;
    });

    const newFeaturesToImport = [];
    for (const [key, sheetMatch] of sheetMap.entries()) {
      // Only process the id entries to avoid duplicates from tpfp entries, and only if not processed
      if (key.startsWith('id:') && sheetMatch && !sheetMatch.processed && sheetMatch.coordinates) {
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
                areaUnit: sheetMatch.areaUnit || '',
                lastUpdated: sheetMatch.lastUpdated || ''
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
      } else if (key.startsWith('id:') && sheetMatch && !sheetMatch.processed && sheetMatch.type === 'Landmark') {
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
      // Guard: preserve any feature that is still mid-save (not yet confirmed written to the
      // sheet) even if it isn't in this fetch's sheet data — otherwise a refresh that lands
      // while a brand-new locally-drawn feature is uploading could silently drop it.
      const finalFeatureIds = new Set([...updatedFeatures, ...newFeaturesToImport].map(f => f.id));
      const latestFeatures = useMapStore.getState().features;
      const unsyncedFeaturesToPreserve = latestFeatures.filter(f =>
        (f.syncStatus === 'pending' || f.syncStatus === 'error') && !finalFeatureIds.has(f.id)
      );
      useMapStore.getState().setFeatures([...updatedFeatures, ...newFeaturesToImport, ...unsyncedFeaturesToPreserve]);
    }

    return updateCount + deleteCount;
  } catch (err) {
    console.error('Failed to sync Google Sheets updates to Map Editor:', err);
    throw err;
  }
};
