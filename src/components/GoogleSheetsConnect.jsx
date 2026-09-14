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

  // Auto-load map from Google Sheets on startup to bypass any local storage reliance
  useEffect(() => {
    if (spreadsheetId) {
      useMapStore.getState().clearAllFeatures(); updateMap();
    }
  }, []); // Run once on mount

  return null;
}
