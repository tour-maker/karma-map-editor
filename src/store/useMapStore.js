import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';

export const useMapStore = create(
  persist(
    temporal(
      (set, get) => ({
        features: [],
        selectedFeatureId: null,
        appMode: 'viewer',
        kmlLayers: [],
        isInfoPanelOpen: false,
        theme: 'dark',
        uiHidden: false,
        showLabels: false,
        showLandmarks: true,
        unresolvedExcelRows: [],

        filterPrimary: null,
        filterSecondary: null,
        filterType: null,
        globalAreaUnit: 'yards',
        customAreas: [],

        addCustomArea: (areaName) => set((state) => {
          const name = areaName?.trim();
          if (!name) return state;
          const exists = (state.customAreas || []).some(a => a.toLowerCase() === name.toLowerCase());
          if (exists) return state;
          return { customAreas: [...(state.customAreas || []), name] };
        }),

        googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID?.replace(/["']/g, '') || '752087917175-92ui9g4v2mct86k9eqgr11kki843v2pe.apps.googleusercontent.com',
        googleAccessToken: null,
        spreadsheetId: import.meta.env.VITE_GOOGLE_SHEET_ID?.replace(/["']/g, '') || '',
        googleSheetsConnected: false,

        getFeature: (id) => get().features.find(f => f.id === id),

        setTheme: (theme) => set({ theme }),
        setAppMode: (mode) => set({ appMode: mode }),
        setIsInfoPanelOpen: (isOpen) => set({ isInfoPanelOpen: isOpen }),
        setUiHidden: (hidden) => set({ uiHidden: Boolean(hidden) }),
        toggleUiHidden: () => set((state) => ({ uiHidden: !state.uiHidden })),
        toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
        toggleLandmarks: () => set((state) => ({ showLandmarks: !state.showLandmarks })),

        setSelectedFeatureId: (id) => set({ selectedFeatureId: id }),

        setFilterPrimary: (city) => set({ filterPrimary: city, filterSecondary: null }),
        setFilterSecondary: (location) => set({ filterSecondary: location }),
        setFilterType: (type) => set({ filterType: type }),
        setGlobalAreaUnit: (unit) => set({ globalAreaUnit: unit }),

        setGoogleAccessToken: (token) => set({ googleAccessToken: token, googleSheetsConnected: true }),
        setSpreadsheetId: (id) => set({ spreadsheetId: id }),
        disconnectGoogleSheets: () => set({ googleAccessToken: null, googleSheetsConnected: false, spreadsheetId: '' }),

        setFeatures: (features) => set((state) => {
          const newIds = new Set(features.map(f => f.id));
          state.features.forEach(feature => {
            if (!newIds.has(feature.id)) {
              if (feature.instances?.polygon) feature.instances.polygon.setMap(null);
              if (feature.instances?.marker) feature.instances.marker.setMap(null);
              if (Array.isArray(feature.instances?.polygon?.pathListeners)) {
                feature.instances.polygon.pathListeners.forEach((l) => window.google?.maps.event.removeListener(l));
              }
            }
          });
          return { features };
        }),

        setUnresolvedExcelRows: (unresolvedExcelRows) => set({ unresolvedExcelRows }),

        addFeatures: (newFeatures) => set((state) => ({
          features: [...state.features, ...newFeatures]
        })),

        updateFeature: (id, updates) => set((state) => ({
          features: state.features.map(f => {
            if (f.id === id) {
              return {
                ...f,
                data: { ...f.data, ...updates.data },
                style: { ...f.style, ...updates.style }
              };
            }
            return f;
          })
        })),

        removeFeature: (id) => set((state) => {
          const feature = state.features.find(f => f.id === id)
          if (feature) {
            if (feature.instances?.polygon) feature.instances.polygon.setMap(null)
            if (feature.instances?.marker) feature.instances.marker.setMap(null)
            if (Array.isArray(feature.instances?.polygon?.pathListeners)) {
              feature.instances.polygon.pathListeners.forEach((l) => window.google?.maps.event.removeListener(l))
            }
          }
          return {
            features: state.features.filter(f => f.id !== id),
            selectedFeatureId: state.selectedFeatureId === id ? null : state.selectedFeatureId
          }
        }),

        removeFeatures: (ids) => set((state) => {
          const idSet = new Set(ids)
          state.features.forEach(feature => {
            if (!idSet.has(feature.id)) return
            if (feature.instances?.polygon) feature.instances.polygon.setMap(null)
            if (feature.instances?.marker) feature.instances.marker.setMap(null)
            if (Array.isArray(feature.instances?.polygon?.pathListeners)) {
              feature.instances.polygon.pathListeners.forEach((l) => window.google?.maps.event.removeListener(l))
            }
          })
          return {
            features: state.features.filter(f => !idSet.has(f.id)),
            selectedFeatureId: idSet.has(state.selectedFeatureId) ? null : state.selectedFeatureId
          }
        }),

        clearAllFeatures: () => set((state) => {
          state.features.forEach(feature => {
            if (feature.instances?.polygon) feature.instances.polygon.setMap(null)
            if (feature.instances?.marker) feature.instances.marker.setMap(null)
            if (Array.isArray(feature.instances?.polygon?.pathListeners)) {
              feature.instances.polygon.pathListeners.forEach((l) => window.google?.maps.event.removeListener(l))
            }
          })
          return {
            features: [],
            selectedFeatureId: null
          }
        }),

        setFeatureInstances: (id, polygonInstance, markerInstance) => set((state) => ({
          features: state.features.map(f =>
            f.id === id ? { ...f, instances: { polygon: polygonInstance, marker: markerInstance } } : f
          )
        })),

        setKmlLayers: (layers) => set({ kmlLayers: layers }),
        toggleKmlLayer: (layerId) => set((state) => ({
          kmlLayers: state.kmlLayers.map(l =>
            l.id === layerId ? { ...l, visible: !l.visible } : l
          )
        }))
      }),
      {
        partialize: (state) => {
          const serializableFeatures = state.features.map(f => {
            const { instances, ...rest } = f;
            return rest;
          });
          return { features: serializableFeatures };
        },
        limit: 100,
      }
    ),
    {
      name: 'map-editor-storage-v2',
      partialize: (state) => {
        return {
          appMode: state.appMode,
          theme: state.theme,
          uiHidden: state.uiHidden,
          showLabels: state.showLabels,
          spreadsheetId: state.spreadsheetId,
          globalAreaUnit: state.globalAreaUnit,
          customAreas: state.customAreas
        };
      }
    }
  )
);

if (import.meta.env.DEV) {
  window.useMapStore = useMapStore;
}
