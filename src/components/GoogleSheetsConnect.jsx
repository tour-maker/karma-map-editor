import { useState, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { FiDatabase, FiRefreshCw } from 'react-icons/fi';
import { CATEGORY_MAP, determineParentLocation } from '../config/categories';
import { fetchAndMergeSheetUpdates, repairSheet1Headers, overwriteSheetWithFeatures, overwriteAreasSheet } from '../services/googleSheets';
import toast from 'react-hot-toast';

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6PYhg46pRnBkkcAfp-RkmreiGHIkwYLcNXI03eujyc1bSSTH0kZZ93auAm7XtcjI/exec';

export default function GoogleSheetsConnect() {
  const [isLoading, setIsLoading] = useState(false);
  const theme = useMapStore(state => state.theme);
  const spreadsheetId = useMapStore(state => state.spreadsheetId);
  const isDark = theme === 'dark';

  useEffect(() => {
    // Polling every 15 seconds to fetch any edits made directly in Google Sheets into the Map Editor
    const interval = setInterval(async () => {
      const updatedCount = await fetchAndMergeSheetUpdates(spreadsheetId);
      if (updatedCount > 0) {
        toast.success(`Updated ${updatedCount} property field(s) from Google Sheets!`);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const syncData = async () => {
    setIsLoading(true);
    try {
      if (spreadsheetId) {
        await repairSheet1Headers(spreadsheetId);
      }

      const updatedCount = await fetchAndMergeSheetUpdates(spreadsheetId);
      if (updatedCount > 0) {
        toast.success(`Merged ${updatedCount} update(s) from Google Sheets!`);
      }

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
          data: {
            tp: tpVal,
            op: opVal,
            fp: fpVal,
            area: areaVal,
            location: loc,
            parentLocation: parentLoc,
            landmark: landmarkVal,
            type: typeVal,
            remarks: remarksVal
          }
        };
      });
      
      const polygonFeatures = cleanFeatures.filter(cf => !(cf.id?.startsWith('landmark-') || cf.category === 'Landmark'));
      
      const headerRow = ['id', 'tp', 'op', 'fp', 'area', 'location', 'parent_location', 'landmark', 'type', 'remarks'];
      const dataRows = polygonFeatures.map(cf => [
        cf.id || '',
        cf.tp || '',
        cf.op || '',
        cf.fp || '',
        cf.area != null ? String(cf.area) : '',
        cf.location || '',
        cf.parentLocation || '',
        cf.landmark || '',
        cf.category || '',
        cf.remarks || ''
      ]);
      const cleanRowsWithHeaders = [headerRow, ...dataRows];

      // Build full areaRows for existing Parent Locations & Secondary Locations
      const areaHeaders = ['Parent Location', 'Secondary Location'];
      const areaRows = [areaHeaders];
      const customAreas = useMapStore.getState().customAreas || [];
      const allParents = Array.from(new Set([...Object.keys(CATEGORY_MAP), ...customAreas]));

      allParents.forEach(parent => {
        const subs = CATEGORY_MAP[parent] || [];
        if (subs.length > 0) {
          subs.forEach(sub => {
            areaRows.push([parent, sub]);
          });
        } else {
          areaRows.push([parent, '']);
        }
      });

      const landmarkRows = currentFeatures
        .filter(f => f.id?.startsWith('landmark-') || f.data?.type === 'Landmark' || f.data?.landmark)
        .map(f => {
          const d = f.data || {};
          const title = d.landmark || d.name || 'Landmark';
          const loc = d.location || 'Surat';
          const parentLoc = d.parentLocation || d.parent_location || determineParentLocation(loc);
          const lat = f.position?.lat || f.center?.lat || '';
          const lng = f.position?.lng || f.center?.lng || '';
          return [
            f.id || '',
            title,
            loc,
            parentLoc,
            lat ? String(lat) : '',
            lng ? String(lng) : '',
            d.remarks || ''
          ];
        });

      toast('Syncing with Google Sheets…');

      // Direct Google Sheets API overwrite if connected via OAuth
      if (spreadsheetId) {
        try {
          const currentPolygons = currentFeatures.filter(f => !(f.id?.startsWith('landmark-') || f.data?.type === 'Landmark'));
          await overwriteSheetWithFeatures(spreadsheetId, currentPolygons);
          await overwriteAreasSheet(spreadsheetId, areaRows);
        } catch (err) {
          console.warn('Direct Google Sheets API overwrite fallback:', err);
        }
      }

      // Apps Script webhook backup sync
      await fetch(DEFAULT_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'sync',
          headers: headerRow,
          rows: cleanRowsWithHeaders,
          areaRows: areaRows,
          landmarkRows,
          features: cleanFeatures
        })
      });
      
      toast.success(`Synced ${cleanFeatures.length} properties & ${allParents.length} areas to Google Sheets!`);
      useMapStore.setState({ googleSheetsConnected: true });
    } catch (err) {
      console.error(err);
      toast.error('Failed to sync with Google Sheets: ' + err.message);
    }
    setIsLoading(false);
  };

  return (
    <button
      onClick={syncData}
      disabled={isLoading}
      className="btn-hover-effect"
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '9px 6px', 
        background: isDark ? 'rgba(34, 197, 94, 0.08)' : '#f0fdf4',
        color: '#4ade80', 
        border: '1px solid rgba(34, 197, 94, 0.35)',
        borderRadius: 10, fontSize: 12, fontWeight: 600, 
        cursor: isLoading ? 'not-allowed' : 'pointer', 
        transition: 'all 0.2s',
        opacity: isLoading ? 0.7 : 1,
        whiteSpace: 'nowrap'
      }}
    >
      {isLoading ? (
        <FiRefreshCw size={13} className="spin" />
      ) : (
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)', flexShrink: 0 }} />
      )}
      {isLoading ? 'Syncing...' : 'Sheets Connected'}
    </button>
  );
}
