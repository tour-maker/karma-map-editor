import { useState, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { fetchAndMergeSheetUpdates, repairSheet1Headers } from '../services/googleSheets';
import toast from 'react-hot-toast';

export default function GoogleSheetsConnect() {
  const [isUpdatingMap, setIsUpdatingMap] = useState(false);
  const theme = useMapStore(state => state.theme);
  const spreadsheetId = useMapStore(state => state.spreadsheetId);
//   const isDark = theme === 'dark';

  // ─── Update Map (Sheet → Map) ────────────────────────────────────────────────
  const updateMap = async (silent = false) => {
    if (!silent) setIsUpdatingMap(true);
    let toastId = null;
    
    if (!silent) {
      toastId = toast.loading('Loading polygons...', { id: 'loading-polygons', duration: Infinity });
    }

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

  // Auto-load map from Google Sheets on startup to bypass any local storage reliance
  useEffect(() => {
    // Sheet reads are proxied through the backend, which has its own configured
    // spreadsheet ID. Do not gate the initial load on the optional browser-side
    // spreadsheetId value, or a normal page refresh can skip loading altogether.
    useMapStore.getState().clearAllFeatures();
    updateMap();
  }, []); // Load polygons and show the loader on every full page load

  return null;
}
