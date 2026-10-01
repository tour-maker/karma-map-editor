import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMapStore } from '../store/useMapStore';
import { fetchAndMergeSheetUpdates, repairSheet1Headers } from '../services/googleSheets';

export default function GoogleSheetsConnect() {
  const [isUpdatingMap, setIsUpdatingMap] = useState(false);
  const theme = useMapStore(state => state.theme);
  const spreadsheetId = useMapStore(state => state.spreadsheetId);
//   const isDark = theme === 'dark';

  // ─── Update Map (Sheet → Map) ────────────────────────────────────────────────
  const updateMap = async (silent = false) => {
    if (!silent) setIsUpdatingMap(true);
    let loaded = false;
    try {
      if (spreadsheetId) {
        await repairSheet1Headers(spreadsheetId);
      }
      await fetchAndMergeSheetUpdates(spreadsheetId);

      if (!silent) {
        // Wait for FeatureInstanceManager to attach the fetched polygons to the
        // map before hiding the loading toast. Sheet data can arrive one render
        // before Google Maps has finished creating the visible polygon overlays.
        await new Promise(resolve => {
          const deadline = Date.now() + 10000;
          const waitForMapPolygons = () => {
            const polygons = useMapStore.getState().features.filter(feature =>
              feature.type === 'polygon' && Array.isArray(feature.coordinates) && feature.coordinates.length >= 3
            );
            if (polygons.length === 0 || polygons.every(feature => feature.instances?.polygon) || Date.now() >= deadline) {
              resolve();
            } else {
              window.setTimeout(waitForMapPolygons, 50);
            }
          };
          waitForMapPolygons();
        });
      }
      loaded = true;
    } catch (err) {
      console.error(err);
      // Keep the startup loader visible and retry while the sheet is
      // unavailable. A failed request must not look like a completed load.
      if (!silent) window.setTimeout(() => updateMap(false), 5000);
    }
    if (!silent && loaded) setIsUpdatingMap(false);
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

  // Auto-load map from Google Sheets on startup to bypass any local storage reliance
  useEffect(() => {
    // Sheet reads are proxied through the backend, which has its own configured
    // spreadsheet ID. Do not gate the initial load on the optional browser-side
    // spreadsheetId value, or a normal page refresh can skip loading altogether.
    updateMap();
  }, []); // Load polygons and show the loader on every full page load

  if (!isUpdatingMap) return null;

  return createPortal(
    <div role="status" aria-live="polite" style={{
      position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 2000001,
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
      borderRadius: 8, background: '#fff', color: '#3c4043',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)', fontSize: 16, whiteSpace: 'nowrap'
    }}>
      <span aria-hidden="true" style={{ width: 14, height: 14, border: '2px solid #dadce0', borderTopColor: '#4285f4', borderRadius: '50%', animation: 'karma-polygons-spin 0.8s linear infinite' }} />
      Loading polygons...
      <style>{'@keyframes karma-polygons-spin { to { transform: rotate(360deg); } }'}</style>
    </div>,
    document.body
  );
}
