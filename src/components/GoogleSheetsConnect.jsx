import { useState, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { FiRefreshCw, FiDownload, FiUpload } from 'react-icons/fi';
import { CATEGORY_MAP, determineParentLocation } from '../config/categories';
import { fetchAndMergeSheetUpdates, repairSheet1Headers, overwriteSheetWithFeatures, overwriteAreasSheet, overwriteLandmarksSheet } from '../services/googleSheets';
import toast from 'react-hot-toast';

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6PYhg46pRnBkkcAfp-RkmreiGHIkwYLcNXI03eujyc1bSSTH0kZZ93auAm7XtcjI/exec';

export default function GoogleSheetsConnect() {
  const [isUpdatingMap, setIsUpdatingMap] = useState(false);
  const [isUpdatingSheet, setIsUpdatingSheet] = useState(false);
  const theme = useMapStore(state => state.theme);
  const spreadsheetId = useMapStore(state => state.spreadsheetId);
  const isDark = theme === 'dark';

  // ─── Update Map (Sheet → Map) ────────────────────────────────────────────────
  const updateMap = async (silent = false) => {
    if (!silent) setIsUpdatingMap(true);
    let toastId = null;
    
    if (!silent) {
      toastId = toast.loading('Loading polygons...', { id: 'loading-polygons' });
    }

    try {
      if (spreadsheetId) {
        await repairSheet1Headers(spreadsheetId);
      }
      await fetchAndMergeSheetUpdates(spreadsheetId);
      
      if (toastId) {
        toast.dismiss(toastId);
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        toast.error('Failed to connect: ' + err.message, { id: toastId || 'error-polygons' });
      }
    }
    if (!silent) setIsUpdatingMap(false);
  };

  // ─── 10-Second Background Polling (Sheet → Map) ────────────────────────────
  useEffect(() => {
    // Only poll if we have a spreadsheet ID
    if (!spreadsheetId) return;

    const intervalId = setInterval(() => {
      // Call updateMap silently so it doesn't spam toasts or loading spinners
      updateMap(true);
    }, 10000); // 10 seconds

    return () => clearInterval(intervalId);
  }, [spreadsheetId]);
  // ─── Global Event Listener for Update Sheet ─────────────────────────────────
  useEffect(() => {
    const handleGlobalUpdateSheet = () => {
      console.log('[Global Event] Triggering Update Sheet...');
      updateSheet();
    };

    window.addEventListener('trigger-update-sheet', handleGlobalUpdateSheet);
    return () => window.removeEventListener('trigger-update-sheet', handleGlobalUpdateSheet);
  }, []);

  // ─── Update Sheet (Map → Sheet) ──────────────────────────────────────────────
  const updateSheet = async () => {
    setIsUpdatingSheet(true);
    try {
      const currentFeatures = useMapStore.getState().features;
      const cleanFeatures = currentFeatures.map(f => {
        const d = f.data || {};
        const loc = d.location || f.location || '';
        const parentLoc = d.parentLocation || d.parent_location || f.parentLocation || determineParentLocation(loc) || '';
        const tpVal = d.tp || f.tp || '';
        const opVal = d.op || f.op || '';
        const fpVal = d.fp || f.fp || '';
        const areaVal = d.area != null ? d.area : (f.area != null ? f.area : '');
        const landmarkVal = d.landmark || f.landmark || '';
        const typeVal = d.type || '';
        const remarksVal = d.remarks || f.remarks || '';
        return {
          id: f.id,
          type: f.type,
          coordinates: f.coordinates || [],
          tp: tpVal,
          op: opVal,
          fp: fpVal,
          area: areaVal,
          location: loc,
          parentLocation: parentLoc,
          landmark: landmarkVal,
          category: typeVal,
          remarks: remarksVal,
          data: { tp: tpVal, op: opVal, fp: fpVal, area: areaVal, location: loc, parentLocation: parentLoc, landmark: landmarkVal, type: typeVal, remarks: remarksVal }
        };
      });

      const polygonFeatures = cleanFeatures.filter(cf => !(cf.id?.startsWith('landmark-') || cf.category === 'Landmark'));

      const headerRow = ['id', 'tp', 'op', 'fp', 'area', 'location', 'parent_location', 'landmark', 'type', 'remarks', 'coordinates'];
      const dataRows = polygonFeatures.map(cf => [
        cf.id || '', cf.tp || '', cf.op || '', cf.fp || '',
        cf.area != null ? String(cf.area) : '',
        cf.location || '', cf.parentLocation || '', cf.landmark || '',
        cf.category || '', cf.remarks || '',
        cf.coordinates && cf.coordinates.length > 0 ? JSON.stringify(cf.coordinates) : ''
      ]);
      const cleanRowsWithHeaders = [headerRow, ...dataRows];

      // Build areaRows
      const areaHeaders = ['Parent Location', 'Secondary Location'];
      const areaRows = [areaHeaders];
      const customAreas = useMapStore.getState().customAreas || [];
      const allParents = Array.from(new Set([...Object.keys(CATEGORY_MAP), ...customAreas]));
      allParents.forEach(parent => {
        const subs = CATEGORY_MAP[parent] || [];
        if (subs.length > 0) {
          subs.forEach(sub => areaRows.push([parent, sub]));
        } else {
          areaRows.push([parent, '']);
        }
      });

      // Build landmark rows - ONLY include dedicated landmark pins
      const seenLandmarkNames = new Set();
      const landmarkRows = currentFeatures
        .filter(f => f.id?.startsWith('landmark-') || f.data?.type === 'Landmark')
        .map(f => {
          const d = f.data || {};
          const loc = d.location || 'Surat';
          const landmarkName = d.landmark || d.name || 'Landmark';
          
          return {
            id: f.id,
            landmarkName,
            loc,
            parentLoc: d.parentLocation || d.parent_location || determineParentLocation(loc),
            lat: f.position?.lat || f.center?.lat || '',
            lng: f.position?.lng || f.center?.lng || '',
            remarks: d.remarks || ''
          };
        })
        .filter(r => {
          if (!r.landmarkName || seenLandmarkNames.has(r.landmarkName.toLowerCase())) return false;
          seenLandmarkNames.add(r.landmarkName.toLowerCase());
          return true;
        })
        .map(r => [r.id, r.landmarkName, r.loc, r.parentLoc, r.lat, r.lng, r.remarks]);

      toast('Updating Google Sheets…');

      console.log('[UpdateSheet] landmarkRows count:', landmarkRows.length);
      console.log('[UpdateSheet] landmarkRows sample:', landmarkRows.slice(0, 2));
      console.log('[UpdateSheet] spreadsheetId:', spreadsheetId);

      // Direct Google Sheets API overwrite
      if (spreadsheetId) {
        try {
          const currentPolygons = currentFeatures.filter(f => !(f.id?.startsWith('landmark-') || f.data?.type === 'Landmark'));
          await overwriteSheetWithFeatures(spreadsheetId, currentPolygons);
          await overwriteAreasSheet(spreadsheetId, areaRows);
          console.log('[UpdateSheet] Calling overwriteLandmarksSheet with', landmarkRows.length, 'rows');
          await overwriteLandmarksSheet(spreadsheetId, landmarkRows);
          console.log('[UpdateSheet] overwriteLandmarksSheet done');
        } catch (err) {
          console.error('Direct Google Sheets API overwrite error:', err);
        }
      }

      // Apps Script webhook backup
      const landmarkHeaders = ['id', 'Landmark Name', 'Location', 'Parent Location', 'Latitude', 'Longitude', 'Remarks'];
      const landmarkRowsWithHeaders = [landmarkHeaders, ...landmarkRows];
      await fetch(DEFAULT_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'sync', headers: headerRow, rows: cleanRowsWithHeaders, areaRows, landmarkRows: landmarkRowsWithHeaders, features: cleanFeatures })
      });

      toast.success(`Sheet updated! ${polygonFeatures.length} polygons & ${allParents.length} areas pushed to Google Sheets.`);
      useMapStore.setState({ googleSheetsConnected: true });

      const newSyncedAreas = areaRows.slice(1).map(row => ({ parent: row[0], secondary: row[1] || '' }));
      useMapStore.setState({ syncedAreas: newSyncedAreas });

      // Mark all features as synced
      const latestFeatures = useMapStore.getState().features;
      useMapStore.getState().setFeatures(latestFeatures.map(f => ({ ...f, syncStatus: 'synced' })));
    } catch (err) {
      console.error(err);
      toast.error('Failed to update Google Sheets: ' + err.message);
    }
    setIsUpdatingSheet(false);
  };

  // Wire "Save" button in PropertyInfoPanel to trigger updateSheet
  useEffect(() => {
    const handleGlobalSync = () => updateSheet();
    window.addEventListener('trigger-global-sync', handleGlobalSync);
    return () => window.removeEventListener('trigger-global-sync', handleGlobalSync);
  }, []); // Added empty dependency array for safety

  // Auto-load map from Google Sheets on startup to bypass any local storage reliance
  useEffect(() => {
    if (spreadsheetId) {
      useMapStore.getState().clearAllFeatures(); updateMap();
    }
  }, []); // Run once on mount

  return null;
}
