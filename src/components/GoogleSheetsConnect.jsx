import { useState, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { FiRefreshCw, FiDownload, FiUpload } from 'react-icons/fi';
import { CATEGORY_MAP, determineParentLocation } from '../config/categories';
import { fetchAndMergeSheetUpdates, repairSheet1Headers, overwriteSheetWithFeatures, overwriteAreasSheet } from '../services/googleSheets';
import toast from 'react-hot-toast';

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6PYhg46pRnBkkcAfp-RkmreiGHIkwYLcNXI03eujyc1bSSTH0kZZ93auAm7XtcjI/exec';

export default function GoogleSheetsConnect() {
  const [isUpdatingMap, setIsUpdatingMap] = useState(false);
  const [isUpdatingSheet, setIsUpdatingSheet] = useState(false);
  const theme = useMapStore(state => state.theme);
  const spreadsheetId = useMapStore(state => state.spreadsheetId);
  const isDark = theme === 'dark';

  // ─── Update Map (Sheet → Map) ────────────────────────────────────────────────
  const updateMap = async () => {
    setIsUpdatingMap(true);
    try {
      if (spreadsheetId) {
        await repairSheet1Headers(spreadsheetId);
      }
      const updatedCount = await fetchAndMergeSheetUpdates(spreadsheetId);
      if (updatedCount > 0) {
        toast.success(`Map updated! ${updatedCount} change(s) pulled from Google Sheets.`);
      } else {
        toast.success('Map is already up to date with Google Sheets!');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch updates from Google Sheets: ' + err.message);
    }
    setIsUpdatingMap(false);
  };

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

      const headerRow = ['id', 'tp', 'op', 'fp', 'area', 'location', 'parent_location', 'landmark', 'type', 'remarks'];
      const dataRows = polygonFeatures.map(cf => [
        cf.id || '', cf.tp || '', cf.op || '', cf.fp || '',
        cf.area != null ? String(cf.area) : '',
        cf.location || '', cf.parentLocation || '', cf.landmark || '',
        cf.category || '', cf.remarks || ''
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

      // Build landmark rows
      const landmarkRows = currentFeatures
        .filter(f => f.id?.startsWith('landmark-') || f.data?.type === 'Landmark')
        .map(f => {
          const d = f.data || {};
          const loc = d.location || 'Surat';
          return [
            f.id || '', d.landmark || d.name || 'Landmark',
            loc, d.parentLocation || d.parent_location || determineParentLocation(loc),
            f.position?.lat || f.center?.lat || '',
            f.position?.lng || f.center?.lng || '',
            d.remarks || ''
          ];
        });

      toast('Updating Google Sheets…');

      // Direct Google Sheets API overwrite
      if (spreadsheetId) {
        try {
          const currentPolygons = currentFeatures.filter(f => !(f.id?.startsWith('landmark-') || f.data?.type === 'Landmark'));
          await overwriteSheetWithFeatures(spreadsheetId, currentPolygons);
          await overwriteAreasSheet(spreadsheetId, areaRows);
        } catch (err) {
          console.warn('Direct Google Sheets API overwrite fallback:', err);
        }
      }

      // Apps Script webhook backup
      await fetch(DEFAULT_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'sync', headers: headerRow, rows: cleanRowsWithHeaders, areaRows, landmarkRows, features: cleanFeatures })
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
  });

  const btnBase = {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    padding: '9px 6px', borderRadius: 10, fontSize: 12, fontWeight: 600,
    transition: 'all 0.2s', whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid'
  };

  return (
    <div style={{ display: 'flex', gap: 6, width: '100%' }}>
      {/* Update Map — Sheet → Map */}
      <button
        onClick={updateMap}
        disabled={isUpdatingMap || isUpdatingSheet}
        className="btn-hover-effect"
        title="Pull latest changes from Google Sheets into the Map"
        style={{
          ...btnBase,
          background: isDark ? 'rgba(99, 102, 241, 0.1)' : '#eef2ff',
          color: '#818cf8',
          borderColor: 'rgba(99, 102, 241, 0.35)',
          opacity: (isUpdatingMap || isUpdatingSheet) ? 0.7 : 1,
          cursor: (isUpdatingMap || isUpdatingSheet) ? 'not-allowed' : 'pointer',
        }}
      >
        {isUpdatingMap ? <FiRefreshCw size={12} className="spin" /> : <FiDownload size={12} />}
        {isUpdatingMap ? 'Updating...' : 'Update Map'}
      </button>

      {/* Update Sheet — Map → Sheet */}
      <button
        onClick={updateSheet}
        disabled={isUpdatingMap || isUpdatingSheet}
        className="btn-hover-effect"
        title="Push all Map changes to Google Sheets"
        style={{
          ...btnBase,
          background: isDark ? 'rgba(34, 197, 94, 0.08)' : '#f0fdf4',
          color: '#4ade80',
          borderColor: 'rgba(34, 197, 94, 0.35)',
          opacity: (isUpdatingMap || isUpdatingSheet) ? 0.7 : 1,
          cursor: (isUpdatingMap || isUpdatingSheet) ? 'not-allowed' : 'pointer',
        }}
      >
        {isUpdatingSheet ? <FiRefreshCw size={12} className="spin" /> : <FiUpload size={12} />}
        {isUpdatingSheet ? 'Updating...' : 'Update Sheet'}
      </button>
    </div>
  );
}
