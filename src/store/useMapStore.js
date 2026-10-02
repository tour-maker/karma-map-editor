import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { getCategoryOptionsForUnit, CATEGORY_MAP } from '../config/categories';

// Plots rescued from a deleted Primary/Sub-area land here instead of disappearing —
// it's a normal location value like any other, so it shows up in the Areas tab
// through the same feature-driven list-building ProjectsPanel already does.
export const UNASSIGNED_LOCATION = 'Unassigned';

export const useMapStore = create(
  persist(
    temporal(
      (set, get) => ({
        features: [],
        selectedFeatureId: null,
        selectedAreaName: null,
        appMode: 'viewer',
        isAdminAuthenticated: false,
        viewerUsername: null,
        isInfoPanelOpen: false,
        theme: 'dark',
        uiHidden: false,
        showLabels: false,
        // Off by default — landmarks only show once the user explicitly turns
        // this on, rather than being on for everyone from the first load.
        showLandmarks: false,
        // Whether the current map zoom is deep enough for landmarks to actually
        // be rendered (LandmarkManager keeps this in sync with its own zoom
        // gate). Separate from showLandmarks, which is the user's manual on/off
        // preference.
        landmarksZoomActive: false,
        // Once true, LandmarkManager's automatic zoom-in-turns-on /
        // zoom-out-turns-off behavior stops adjusting showLandmarks. Only set
        // when the user manually clicks the toggle ON — that's a deliberate
        // "keep landmarks on" choice that zooming back out should no longer
        // undo. Manually clicking it OFF clears this instead, handing control
        // back to the automatic zoom behavior (so zooming in later still
        // auto-turns it on again, same as if it had never been touched).
        // Reset to false on every fresh load (not persisted).
        landmarksManualOverride: false,

        filterPrimary: null,
        filterSecondary: null,
        filterType: null,
        globalAreaUnit: null,
        customAreas: [],
        syncedAreas: [],
        previewSubmission: null,
        myRequestsSubmissions: [],
        myRequestsStatusFilter: null,

        setPreviewSubmission: (sub) => set({ previewSubmission: sub }),
        setMyRequestsSubmissions: (subs) => set({ myRequestsSubmissions: subs || [] }),
        setMyRequestsStatusFilter: (status) => set({ myRequestsStatusFilter: status }),

        addCustomArea: (areaName) => set((state) => {
          const name = areaName?.trim();
          if (!name) return state;
          const exists = (state.customAreas || []).some(a => a.toLowerCase() === name.toLowerCase());
          if (exists) return state;
          return { customAreas: [...(state.customAreas || []), name] };
        }),
        
        renameArea: (oldName, newName) => set((state) => {
          const trimmedOld = oldName?.trim();
          const trimmedNew = newName?.trim();
          if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return state;

          // update customAreas
          const customAreas = (state.customAreas || []).map(a =>
             a.toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : a
          );

          // A hardcoded CATEGORY_MAP default (e.g. "Surat") is runtime-mutable, same
          // as AddAreaModal already treats it — rename its key too so the new name
          // is what reappears in the Areas tab, not the old one.
          if (CATEGORY_MAP[trimmedOld] !== undefined) {
            CATEGORY_MAP[trimmedNew] = CATEGORY_MAP[trimmedOld];
            delete CATEGORY_MAP[trimmedOld];
          }

          // update all features with this location or parentLocation
          const features = state.features.map(f => {
             let changed = false;
             const newData = { ...f.data };

             if (newData.location?.toLowerCase() === trimmedOld.toLowerCase()) {
                newData.location = trimmedNew;
                changed = true;
             }
             if (newData.parentLocation?.toLowerCase() === trimmedOld.toLowerCase()) {
                newData.parentLocation = trimmedNew;
                changed = true;
             }

             if (changed) {
                return { ...f, data: newData };
             }
             return f;
          });

          return { customAreas, features, selectedAreaName: trimmedNew };
        }),

        // Deletes a Primary Location. Never destroys its plots: every feature that
        // still points at it (only its own — Sub-areas must be moved/merged out
        // first, enforced by the UI) is rescued into the Unassigned bucket rather
        // than vanishing. Works for both a customArea and a hardcoded CATEGORY_MAP
        // default — the default's key is removed too so it actually stops
        // reappearing, matching how renameArea already treats CATEGORY_MAP as
        // runtime-mutable.
        deleteArea: (areaName) => set((state) => {
          const trimmed = areaName?.trim();
          if (!trimmed) return state;

          const customAreas = (state.customAreas || []).filter(a => a.toLowerCase() !== trimmed.toLowerCase());

          if (CATEGORY_MAP[trimmed] !== undefined) {
            delete CATEGORY_MAP[trimmed];
          }

          const features = state.features.map(f => {
            const par = f.data?.parentLocation;
            if (par && par.toLowerCase() === trimmed.toLowerCase()) {
              return { ...f, syncStatus: 'edited', data: { ...f.data, location: UNASSIGNED_LOCATION, parentLocation: UNASSIGNED_LOCATION } };
            }
            return f;
          });

          return { customAreas, features, selectedAreaName: null };
        }),

        // Deletes a Sub-area. Sub-locations are purely feature-derived (see
        // buildDynamicLocationMap) — there's no config key to clean up — so rescuing
        // every matching feature into Unassigned is enough for it to stop appearing.
        deleteSubLocation: (parentName, subName) => set((state) => {
          const trimmedParent = parentName?.trim();
          const trimmedSub = subName?.trim();
          if (!trimmedParent || !trimmedSub) return state;

          const features = state.features.map(f => {
            const loc = f.data?.location;
            const par = f.data?.parentLocation;
            if (loc && par && loc.toLowerCase() === trimmedSub.toLowerCase() && par.toLowerCase() === trimmedParent.toLowerCase()) {
              return { ...f, syncStatus: 'edited', data: { ...f.data, location: UNASSIGNED_LOCATION, parentLocation: UNASSIGNED_LOCATION } };
            }
            return f;
          });

          return { features };
        }),

        // Moves a whole Primary Location to become a Sub-area of a different
        // Primary. If the source itself had Sub-areas, they come along flattened
        // (they keep their own `location`, only their `parentLocation` changes) —
        // matches the agreed design behavior.
        mergeAreaIntoPrimary: (sourceName, targetName) => set((state) => {
          const trimmedSource = sourceName?.trim();
          const trimmedTarget = targetName?.trim();
          if (!trimmedSource || !trimmedTarget || trimmedSource.toLowerCase() === trimmedTarget.toLowerCase()) return state;

          const customAreas = (state.customAreas || []).filter(a => a.toLowerCase() !== trimmedSource.toLowerCase());

          if (CATEGORY_MAP[trimmedSource] !== undefined) {
            delete CATEGORY_MAP[trimmedSource];
          }

          const features = state.features.map(f => {
            const par = f.data?.parentLocation;
            if (par && par.toLowerCase() === trimmedSource.toLowerCase()) {
              return { ...f, syncStatus: 'edited', data: { ...f.data, parentLocation: trimmedTarget } };
            }
            return f;
          });

          return { customAreas, features, selectedAreaName: trimmedTarget };
        }),

        // Moves a Sub-area out from under its current parent into a different
        // Primary Location — it stays a Sub-area, just relocated.
        moveSubArea: (subName, oldParentName, newParentName) => set((state) => {
          const trimmedSub = subName?.trim();
          const trimmedOldParent = oldParentName?.trim();
          const trimmedNewParent = newParentName?.trim();
          if (!trimmedSub || !trimmedOldParent || !trimmedNewParent) return state;

          const features = state.features.map(f => {
            const loc = f.data?.location;
            const par = f.data?.parentLocation;
            if (loc && par && loc.toLowerCase() === trimmedSub.toLowerCase() && par.toLowerCase() === trimmedOldParent.toLowerCase()) {
              return { ...f, syncStatus: 'edited', data: { ...f.data, parentLocation: trimmedNewParent } };
            }
            return f;
          });

          return { features };
        }),

        // Promotes a Sub-area to stand on its own as a new Primary Location.
        promoteSubToPrimary: (subName, oldParentName) => set((state) => {
          const trimmedSub = subName?.trim();
          const trimmedOldParent = oldParentName?.trim();
          if (!trimmedSub || !trimmedOldParent) return state;

          const exists = (state.customAreas || []).some(a => a.toLowerCase() === trimmedSub.toLowerCase());
          const customAreas = exists ? state.customAreas : [...(state.customAreas || []), trimmedSub];

          const features = state.features.map(f => {
            const loc = f.data?.location;
            const par = f.data?.parentLocation;
            if (loc && par && loc.toLowerCase() === trimmedSub.toLowerCase() && par.toLowerCase() === trimmedOldParent.toLowerCase()) {
              return { ...f, syncStatus: 'edited', data: { ...f.data, parentLocation: trimmedSub } };
            }
            return f;
          });

          return { customAreas, features };
        }),

        // Manually re-homes one or more rescued Unassigned plots into a chosen
        // location (a Primary with no Sub-areas, or a specific Sub-area).
        reassignFeaturesTo: (featureIds, newLocation, newParentLocation) => set((state) => {
          const idSet = new Set(featureIds);
          const features = state.features.map(f => {
            if (!idSet.has(f.id)) return f;
            return { ...f, data: { ...f.data, location: newLocation, parentLocation: newParentLocation } };
          });
          return { features };
        }),

        googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID?.replace(/["']/g, '') || '752087917175-92ui9g4v2mct86k9eqgr11kki843v2pe.apps.googleusercontent.com',
        googleAccessToken: null,
        spreadsheetId: import.meta.env.VITE_GOOGLE_SHEET_ID?.replace(/["']/g, '') || '',
        googleSheetsConnected: false,

        getFeature: (id) => get().features.find(f => f.id === id),

        setTheme: (theme) => set({ theme }),
        setAppMode: (mode) => set({ appMode: mode }),
        setIsAdminAuthenticated: (auth) => set({ isAdminAuthenticated: auth }),
        setViewerUsername: (username) => set({ viewerUsername: username }),
        setIsInfoPanelOpen: (isOpen) => set({ isInfoPanelOpen: isOpen }),
        setUiHidden: (hidden) => set({ uiHidden: Boolean(hidden) }),
        toggleUiHidden: () => set((state) => ({ uiHidden: !state.uiHidden })),
        toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
        // Manually turning it ON is a sticky "keep this on" choice — it marks
        // landmarksManualOverride so LandmarkManager's automatic zoom-based
        // on/off stops turning it back off on zoom-out. Manually turning it
        // OFF clears the override instead, so automatic zoom behavior takes
        // back over (zooming in later will auto-turn it on again).
        toggleLandmarks: () => set((state) => {
          const next = !state.showLandmarks;
          return { showLandmarks: next, landmarksManualOverride: next };
        }),
        // Used by LandmarkManager's automatic zoom-based on/off — separate
        // from toggleLandmarks (a manual, sticky flip) so it can set an exact
        // value without marking it as a manual override.
        setShowLandmarks: (show) => set((state) =>
          state.showLandmarks === show ? state : { showLandmarks: show }
        ),
        setLandmarksZoomActive: (active) => set((state) =>
          state.landmarksZoomActive === active ? state : { landmarksZoomActive: active }
        ),

        setSelectedFeatureId: (id) => set({ selectedFeatureId: id }),
        setSelectedAreaName: (name) => set({ selectedAreaName: name }),

        setFilterPrimary: (city) => set({ filterPrimary: city, filterSecondary: null }),
        setFilterSecondary: (location) => set({ filterSecondary: location }),
        setFilterType: (type) => set({ filterType: type }),
        // Clears the active category filter if it no longer applies to the new area unit —
        // guards against any caller (not just FilterBar) changing globalAreaUnit directly.
        setGlobalAreaUnit: (unit) => set((state) => {
          const filterType = state.filterType && !getCategoryOptionsForUnit(unit).includes(state.filterType)
            ? null
            : state.filterType;
          return { globalAreaUnit: unit, filterType };
        }),

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

        addFeatures: (newFeatures) => set((state) => ({
          features: [...state.features, ...newFeatures]
        })),

        updateFeature: (id, updates) => set((state) => ({
          features: state.features.map(f => {
            if (f.id === id) {
              const { data, style, ...restUpdates } = updates || {};
              return {
                ...f,
                ...restUpdates,
                data: { ...f.data, ...data },
                style: { ...f.style, ...style }
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
          spreadsheetId: state.spreadsheetId,
          customAreas: state.customAreas,
          syncedAreas: state.syncedAreas,
          // Deliberately not persisted — App.jsx forces this back to false on
          // every load/reload so the admin has to sign back in each time.
          googleAccessToken: state.googleAccessToken,
        };
      }
    }
  )
);

if (import.meta.env.DEV) {
  window.useMapStore = useMapStore;
}
