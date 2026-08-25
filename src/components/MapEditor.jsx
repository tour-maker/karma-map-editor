import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { useCallback, useRef, useEffect, useState } from 'react';
import SearchBox from './SearchBox';
import PolygonDrawingManager from './PolygonDrawingManager';
import ProjectsPanel from './ProjectsPanel';
import PropertyInfoPanel from './PropertyInfoPanel';
import AddLandmarkModal from './AddLandmarkModal';
import CustomZoomControl from './ui/CustomZoomControl';
import LocateControl from './ui/LocateControl';
import FilterBar from './ui/FilterBar';
import TopStatsBar from './ui/TopStatsBar';
import RightActionDock from './ui/RightActionDock';
import WhatsAppCTA from './ui/WhatsAppCTA';
import FeatureInstanceManager from './FeatureInstanceManager';
import LandmarkManager from './LandmarkManager';
import { useMapStore } from '../store/useMapStore';
import { useGoogleMap, useSetGoogleMap } from '../context/GoogleMapContext';
import {
  calculatePolygonCenter,
  fitAllBounds,
  fitKmlBounds,
  getGoogleMapsApiKey,
  getPolygonCoordinates,
  GOOGLE_MAPS_LIBRARIES,
  zoomToKmlFeature,
  zoomToProperty
} from '../services/googleMaps';
import { FiUploadCloud } from 'react-icons/fi';
import importKmlFromFile from '../utils/kmlImport';
import importXlsxFromFile, { importPropertiesFromFile, generateSquarePolygon } from '../utils/xlsxImport';
import matchPropertiesToPolygons, { isPointInPolygon } from '../utils/matchPropertiesToPolygons';
import { validateFeature } from '../utils/validation';
import toast from 'react-hot-toast';

const defaultCenter = {
  lat: 21.1702,
  lng: 72.8311
};

export default function MapEditor() {
  const apiKey = getGoogleMapsApiKey();
  const map = useGoogleMap();
  const setMap = useSetGoogleMap();

  // Zustand State
  const appMode = useMapStore(state => state.appMode);
  const theme = useMapStore(state => state.theme);
  const uiHidden = useMapStore(state => state.uiHidden);
  const showLabels = useMapStore(state => state.showLabels);
  const features = useMapStore(state => state.features);
  const selectedFeatureId = useMapStore(state => state.selectedFeatureId);
  const setSelectedFeatureId = useMapStore(state => state.setSelectedFeatureId);
  const addFeatures = useMapStore(state => state.addFeatures);
  const updateFeature = useMapStore(state => state.updateFeature);
  const removeFeature = useMapStore(state => state.removeFeature);
  const removeFeatures = useMapStore(state => state.removeFeatures);
  const setFeatures = useMapStore(state => state.setFeatures);
  const setKmlLayers = useMapStore(state => state.setKmlLayers);
  const setIsInfoPanelOpen = useMapStore(state => state.setIsInfoPanelOpen);
  const setUnresolvedExcelRows = useMapStore(state => state.setUnresolvedExcelRows);

  const isDark = theme === 'dark';
  const containerStyle = {
    width: '100%',
    height: '100vh',
    minHeight: '100vh',
    overflow: 'hidden',
    background: isDark ? '#020617' : '#0f172a'
  };

  const drawingManagerRef = useRef(null);
  const [searchMarkerPos, setSearchMarkerPos] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      useMapStore.getState().setAppMode('viewer');
    }
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  const handleMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, [setMap]);

  const handlePlaceSelected = useCallback(
    (place) => {
      if (!place?.geometry?.location || !map) return;
      const lat = typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : place.geometry.location.lat;
      const lng = typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : place.geometry.location.lng;
      const nextCenter = { lat, lng };

      const currentFeatures = useMapStore.getState().features;

      // 1. Check if place had an explicitly matched feature from SearchBox
      let targetFeature = place.matchedFeature || null;

      // 2. Check if search coordinates fall inside any polygon feature
      if (!targetFeature) {
        targetFeature = currentFeatures.find(f => {
          if (f.type === 'polygon' && Array.isArray(f.coordinates) && f.coordinates.length >= 3) {
            return isPointInPolygon(nextCenter, f.coordinates);
          }
          return false;
        });
      }

      // Set classic Red Pin marker at searched location
      setSearchMarkerPos(nextCenter);

      // If a polygon is matched, select it and open info panel directly!
      if (targetFeature) {
        setSelectedFeatureId(targetFeature.id);
        setIsInfoPanelOpen(true);
        zoomToProperty(map, targetFeature);
      } else {
        map.panTo(nextCenter);
        map.setZoom(15);
      }
    },
    [map, setSelectedFeatureId, setIsInfoPanelOpen]
  );

  const handlePolygonComplete = useCallback((polygonInstance) => {
    if (!polygonInstance || !polygonInstance.isCompleted) return;

    const coordinates = getPolygonCoordinates(polygonInstance);
    if (coordinates.length < 3) return;

    const center = calculatePolygonCenter(coordinates);
    if (!center) return;

    let calculatedArea = null;
    if (window.google?.maps?.geometry?.spherical) {
      const path = coordinates.map(c => new window.google.maps.LatLng(c.lat, c.lng));
      const areaSqMeters = window.google.maps.geometry.spherical.computeArea(path);
      calculatedArea = Math.round(areaSqMeters * 1.19599); // convert sq meters to sq yards
    }

    const id = `drawn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const newFeature = {
      id,
      source: 'drawn',
      type: 'polygon',
      coordinates,
      center,
      data: {
        tp: '',
        op: '',
        fp: '',
        area: calculatedArea || '',
        location: 'Surat',
        parentLocation: 'Surat',
        landmark: '',
        type: 'Freehold',
        remarks: ''
      },
      style: {
        fillColor: '#facc15',
        fillOpacity: 0.4,
        strokeColor: '#facc15',
        strokeWeight: 2,
        visible: true
      }
    };

    addFeatures([validateFeature(newFeature)]);
    const store = useMapStore.getState();
    store.setSelectedFeatureId(id);
    store.setIsInfoPanelOpen(true);
    store.setAppMode('edit');
    toast.success('Polygon added — area calculated');

    // Remove the instance drawn by PolygonDrawingManager, FeatureInstanceManager will redraw it.
    polygonInstance.setMap(null);
    if (Array.isArray(polygonInstance.pathListeners)) {
      polygonInstance.pathListeners.forEach((listener) => {
        window.google?.maps.event.removeListener(listener);
      });
    }

  }, [features, addFeatures]);

  // Import only — no KML matching happens here. Excel rows with a real
  // position are added as their own standalone pins/polygons; rows with no
  // resolvable location (but a TP/FP) are held in unresolvedExcelRows.
  // Matching against KML polygons is a separate, explicit step the user
  // triggers with the "Map Pins" action once everything is imported.
  const handleImportXlsx = useCallback(async (file, existingFeatures = null) => {
    try {
      const res = await importPropertiesFromFile(file);
      const properties = res?.properties || res?.features || [];
      const unresolved = res?.unresolved || [];
      const baseFeatures = existingFeatures || features;
      const otherFeatures = baseFeatures.filter(f => f.source !== 'excel');
      const nextFeatures = [...otherFeatures, ...properties];

      setFeatures(nextFeatures);
      setUnresolvedExcelRows(unresolved);

      toast.success(`Imported ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} from Excel`);
      if (unresolved.length > 0) {
        toast(`${unresolved.length} row(s) have no resolvable location — use "Map Pins" to try matching them by TP/FP.`, { icon: 'ℹ️' });
      }

      if (map) {
        const allCoords = properties.flatMap(f => f.coordinates || [f.position]).filter(Boolean);
        if (allCoords.length > 0) {
          const bounds = new window.google.maps.LatLngBounds();
          allCoords.forEach(c => bounds.extend(c));
          map.fitBounds(bounds);
        }
      }

      return nextFeatures;
    } catch (error) {
      console.error(error);
      toast.error('Failed to import Excel');
      return existingFeatures || features;
    }
  }, [features, map, setFeatures, setUnresolvedExcelRows]);

  // Explicit action: match currently-imported Excel pins (both standalone
  // markers and identifier-only rows) against currently-imported KML
  // polygons. A polygon that gets matched absorbs the pin's data and the
  // standalone pin is removed; anything left unmatched stays as-is.
  const handleMapPinsToPolygons = useCallback(() => {
    const state = useMapStore.getState();
    const currentFeatures = state.features;
    const unresolvedExcelRows = state.unresolvedExcelRows;

    const markerProps = currentFeatures.filter(f => f.source === 'excel' && f.type === 'marker' && f.position);
    const kmlPolygons = currentFeatures.filter(f => f.source === 'kml' && f.type === 'polygon');

    if (markerProps.length === 0 && unresolvedExcelRows.length === 0) {
      toast('Nothing to map — import Excel pins first.', { icon: 'ℹ️' });
      return;
    }
    if (kmlPolygons.length === 0) {
      toast.error('No KML polygons loaded to map against.');
      return;
    }

    const geometryPins = markerProps.map(prop => ({
      id: prop.id,
      tp: prop.data?.tp,
      fp: prop.data?.fp,
      position: prop.position
    }));
    const identifierOnlyPins = unresolvedExcelRows.map(item => ({
      id: item.id,
      tp: item.tp,
      fp: item.fp
    }));
    const pins = [...geometryPins, ...identifierOnlyPins];

    const polygonCandidates = kmlPolygons.map(poly => ({
      id: poly.id,
      tp: poly.data?.tp,
      fp: poly.data?.fp,
      coordinates: poly.coordinates
    }));

    const matchResults = matchPropertiesToPolygons(pins, polygonCandidates, { maxDistanceMeters: 1000 });
    const resultByPinId = new Map(matchResults.map(result => [result.pinId, result]));
    const polygonById = new Map(currentFeatures.map(f => [f.id, f]));

    const mergeIntoPolygon = (matchedPoly, dataPatch, result) => {
      const mergedData = { ...matchedPoly.data };
      if (dataPatch) {
        Object.entries(dataPatch).forEach(([key, val]) => {
          if (val !== '' && val != null) {
            mergedData[key] = val;
          }
        });
      }

      polygonById.set(matchedPoly.id, {
        ...matchedPoly,
        data: {
          ...mergedData,
          name: dataPatch.name || matchedPoly.data.name, // Prefer Excel name if exists
          matchTier: result.tier,
          matchDistanceMeters: result.distanceMeters
        }
      });
    };

    const mappedMarkerIds = new Set();
    const remainingUnresolved = [];
    let mappedCount = 0;

    markerProps.forEach(prop => {
      const result = resultByPinId.get(prop.id);
      const matchedPoly = result?.polygonId ? polygonById.get(result.polygonId) : null;

      if (matchedPoly) {
        mergeIntoPolygon(matchedPoly, prop.data, result);
        mappedMarkerIds.add(prop.id);
        mappedCount++;
      } else if (prop.data?.area) {
        // No KML polygon nearby — give it its own visual footprint instead
        // of remaining a plain, dimensionless pin.
        const squareCoordinates = generateSquarePolygon(prop.position, prop.data.area);
        if (squareCoordinates.length >= 3) {
          polygonById.set(prop.id, validateFeature({
            ...prop,
            type: 'polygon',
            position: undefined,
            coordinates: squareCoordinates
          }));
        }
      }
    });

    unresolvedExcelRows.forEach(item => {
      const result = resultByPinId.get(item.id);
      const matchedPoly = result?.polygonId ? polygonById.get(result.polygonId) : null;

      if (matchedPoly) {
        mergeIntoPolygon(matchedPoly, item.data, result);
        mappedCount++;
      } else {
        // No location and no TP/FP match — there is nowhere to place this
        // on the map yet. Keep it pending rather than losing it, in case a
        // later KML import gives it something to match against.
        remainingUnresolved.push(item);
      }
    });

    const nextFeatures = currentFeatures
      .filter(f => !mappedMarkerIds.has(f.id))
      .map(f => polygonById.get(f.id) ?? f);

    setFeatures(nextFeatures);
    setUnresolvedExcelRows(remainingUnresolved);

    if (mappedCount > 0) {
      toast.success(`Mapped ${mappedCount} pin(s) to their matching polygons.`);
    } else {
      toast('No pins matched any polygon.', { icon: 'ℹ️' });
    }

    if (remainingUnresolved.length > 0) {
      toast.error(`${remainingUnresolved.length} row(s) still have no usable location and didn't match any TP/FP.`);
    }
  }, [setFeatures, setUnresolvedExcelRows]);

  /**
   * 1. Parse Excel → extract all rows with valid lat/lng positions
   * 2. For each pin, find the nearest KML polygon using:
   *    - Contains (pin falls inside polygon boundary)  ← highest priority
   *    - Nearest boundary within maxDistanceMeters     ← fallback
   * 3. Multiple Excel rows CAN map to the same polygon (last-write-wins).
   *    This intentionally bypasses the one-pin-per-polygon exclusivity used
   *    by the manual Map Pins action, because here the goal is to enrich as
   *    many polygons as possible rather than to avoid data collisions.
   */
  const handleImportAndAutoMatch = useCallback(async (file) => {
    const toastId = toast.loading('Importing Excel and matching to polygons…');
    try {
      const currentFeatures = useMapStore.getState().features;
      const kmlPolygons = currentFeatures.filter(f => f.source === 'kml' && f.type === 'polygon');

      if (kmlPolygons.length === 0) {
        toast.error('No KML polygons loaded. Please import a KML file first.', { id: toastId });
        return;
      }

      // Step 1 — parse Excel
      const excelRes = await importPropertiesFromFile(file);
      const properties = excelRes?.properties || excelRes?.features || [];
      const unresolved = excelRes?.unresolved || [];
      if (properties.length === 0 && unresolved.length === 0) {
        toast.error('No property rows found in the Excel file.', { id: toastId });
        return;
      }

      // Step 2 — extract pins with valid positions, plus identifier-only
      // rows (no coordinates, but may still match via TP/FP)
      const pins = properties
        .filter(f => f.position && Number.isFinite(f.position.lat) && Number.isFinite(f.position.lng))
        .map(f => ({ id: f.id, position: f.position, tp: f.data?.tp, fp: f.data?.fp, data: f.data }));
      const identifierOnlyPins = unresolved.map(item => ({
        id: item.id,
        tp: item.tp,
        fp: item.fp,
        data: item.data
      }));
      const allPins = [...pins, ...identifierOnlyPins];

      const MAX_DIST_M = 2000; // generous cap — boundary distance, not centroid

      const polygonCandidates = kmlPolygons
        .filter(poly => Array.isArray(poly.coordinates) && poly.coordinates.length >= 3)
        .map(poly => ({ id: poly.id, tp: poly.data?.tp, fp: poly.data?.fp, coordinates: poly.coordinates }));

      // Step 3 — match every pin to a polygon using the shared, tested
      // matcher (exact TP/FP → contains → nearest-border, strict 1-to-1).
      const matchResults = matchPropertiesToPolygons(allPins, polygonCandidates, { maxDistanceMeters: MAX_DIST_M });
      const pinById = new Map(allPins.map(p => [p.id, p]));

      const polygonDataMap = new Map();
      let matchedPinCount = 0;
      let unmatchedPinCount = 0;

      matchResults.forEach(result => {
        if (result.polygonId) {
          matchedPinCount++;
          polygonDataMap.set(result.polygonId, {
            data: pinById.get(result.pinId)?.data,
            distM: result.distanceMeters ?? 0,
            tier: result.tier
          });
        } else {
          unmatchedPinCount++;
        }
      });

      // Step 4 — apply data to matched polygons
      const updatedFeatures = currentFeatures.map(feature => {
        if (feature.source !== 'kml' || feature.type !== 'polygon') return feature;
        const match = polygonDataMap.get(feature.id);
        if (!match) return feature;
        const d = match.data;
        return {
          ...feature,
          data: {
            ...feature.data,
            name: d?.name || feature.data?.name || '',
            tp: d?.tp || feature.data?.tp || '',
            op: d?.op || feature.data?.op || '',
            fp: d?.fp || feature.data?.fp || '',
            area: d?.area || feature.data?.area || '',
            location: d?.location || feature.data?.location || '',
            landmark: d?.landmark || feature.data?.landmark || '',
            type: d?.type || feature.data?.type || '',

            remarks: d?.remarks || feature.data?.remarks || '',
            matchTier: match.tier,
            matchDistanceMeters: Math.round(match.distM),
          }
        };
      });

      // Keep only mapped KML features (both polygons and pins/markers)
      const mappedFeatures = updatedFeatures.filter(feature => {
        if (feature.source === 'kml') {
          return Boolean(feature.data?.matchTier);
        }
        return true;
      });

      setFeatures(mappedFeatures);
      setUnresolvedExcelRows([]);

      toast.dismiss(toastId);
      toast.success(
        `✅ Matched ${matchedPinCount} / ${allPins.length} rows to polygons. ${polygonDataMap.size} unique polygons enriched.`,
        { duration: 6000 }
      );
      if (unresolved.length > 0) {
        toast(
          `ℹ️ ${unresolved.length} row(s) had no plain coordinates (e.g. Google Maps share links) — matched by TP/FP identifier instead where possible.`,
          { duration: 8000, icon: '⚠️' }
        );
      }
      if (unmatchedPinCount > 0) {
        toast(`⚠️ ${unmatchedPinCount} row(s) had no polygon within ${MAX_DIST_M}m.`, { duration: 6000 });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to import & match: ' + err.message, { id: toastId });
    }
  }, [setFeatures, setUnresolvedExcelRows]);

  // Prune KML polygons that never got merged with an Excel pin, keeping only
  // the ones that did. A single removeFeatures() call = a single undo step,
  // so this is fully reversible with the normal Undo button.
  const handleRemoveUnmappedKmlPolygons = useCallback(() => {
    const currentFeatures = useMapStore.getState().features;
    const unmappedIds = currentFeatures
      .filter(f => f.source === 'kml' && f.type === 'polygon' && !f.data?.matchTier)
      .map(f => f.id);

    if (unmappedIds.length === 0) {
      toast('No unmapped KML polygons to remove.', { icon: 'ℹ️' });
      return;
    }

    removeFeatures(unmappedIds);
    toast.success(`Removed ${unmappedIds.length} unmapped KML polygon(s). Use Undo to bring them back.`);
  }, [removeFeatures]);

  const handleImportGeoJson = useCallback(async (file) => {
    try {
      const { features: newFeatures, warnings } = await importFeaturesFromGeoJSON(file);
      const otherFeatures = features.filter(f => f.source !== 'geojson');
      setFeatures([...otherFeatures, ...newFeatures]);
      toast.success(`Imported ${newFeatures.length} GeoJSON features`);
      if (warnings?.length > 0) {
        toast.error(`There were ${warnings.length} warnings during import`);
      }

      if (map) {
        const bounds = new window.google.maps.LatLngBounds();
        newFeatures.forEach(p => p.coordinates?.forEach(c => bounds.extend(c)));
        if (!bounds.isEmpty()) map.fitBounds(bounds);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to import GeoJSON');
    }
  }, [features, map, setFeatures]);

  const handleImportKml = useCallback(async (file, existingFeatures = null) => {
    try {
      const { layers, polygons, markers } = await importKmlFromFile(file);
      const baseFeatures = existingFeatures || features;
      const otherFeatures = baseFeatures.filter(f => f.source !== 'kml');
      setFeatures([...otherFeatures, ...polygons, ...markers]);
      setKmlLayers(layers);

      const importedCount = polygons.length + markers.length;
      toast.success(`Imported ${importedCount} features from KML`);
      if (polygons.length > 0) {
        toast.success(`Allocated ${polygons.length} centered pins for polygons`);
      }

      if (map) {
        const bounds = new window.google.maps.LatLngBounds();
        polygons.forEach(p => p.coordinates?.forEach(c => bounds.extend(c)));
        markers.forEach(m => { if (m.position) bounds.extend(m.position); });
        if (!bounds.isEmpty()) map.fitBounds(bounds);
      }
      return [...otherFeatures, ...polygons, ...markers];
    } catch (error) {
      console.error(error);
      toast.error('Failed to import KML');
      return existingFeatures || features;
    }
  }, [features, map, setFeatures, setKmlLayers]);

  const loadDefaults = useCallback(async () => {
    try {
      toast('Auto-loading default project files...', { id: 'autoload', icon: '⏳' });

      const kmlRes = await fetch('/default.kml').catch(() => null);
      const xlsxRes = await fetch('/default.xlsx').catch(() => null);

      if (kmlRes?.ok && xlsxRes?.ok) {
        const kmlFile = new File([await kmlRes.blob()], 'default.kml');
        const xlsxFile = new File([await xlsxRes.blob()], 'default.xlsx');

        // Clear existing features before loading defaults
        setFeatures([]);

        const newFeatures = await handleImportKml(kmlFile, []);
        await handleImportXlsx(xlsxFile, newFeatures);
        toast.success('Default data loaded successfully!', { id: 'autoload' });
      } else {
        toast.error('Failed to fetch default files. Are they in the public folder?', { id: 'autoload' });
      }
    } catch (err) {
      console.error('Failed to auto-load defaults', err);
      toast.error('Error auto-loading defaults', { id: 'autoload' });
    }
  }, [handleImportKml, handleImportXlsx, setFeatures]);

  // Auto-load from Google Sheets is handled by GoogleSheetsConnect on mount.
  // KML / Excel auto-import has been removed.

  const [isPlacingLandmark, setIsPlacingLandmark] = useState(false);
  const [landmarkModalPos, setLandmarkModalPos] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const handleStartAddLandmark = () => {
    setIsPlacingLandmark(true);
    toast('Click anywhere on the map to place your Landmark pin', { icon: '📍' });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingFile) setIsDraggingFile(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDraggingFile(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const files = Array.from(e.dataTransfer.files);
    if (!files || files.length === 0) return;

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'kml' || ext === 'kmz') {
        toast.loading(`Auto-importing ${file.name}...`, { id: 'kml-drop' });
        await handleImportKml(file);
        toast.success(`Imported KML file: ${file.name}`, { id: 'kml-drop' });
      } else if (ext === 'xlsx' || ext === 'xls') {
        toast.loading(`Auto-importing ${file.name}...`, { id: 'excel-drop' });
        await handleImportAndAutoMatch(file);
      } else if (ext === 'geojson' || ext === 'json') {
        toast.loading(`Auto-importing ${file.name}...`, { id: 'geojson-drop' });
        await handleImportGeoJson(file);
      }
    }
  };

  if (!apiKey) {
    return <div style={{ padding: 24, fontFamily: 'sans-serif', color: 'white' }}>Google Maps API key is missing.</div>;
  }

  if (loadError) {
    return <div style={{ padding: 24, fontFamily: 'sans-serif', color: 'white' }}>Error loading Google Maps API.</div>;
  }

  return (
    <div
      style={containerStyle}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFile && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(16px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          border: '4px dashed #3b82f6', borderRadius: 20, margin: 16, pointerEvents: 'none'
        }}>
          <FiUploadCloud size={64} color="#60a5fa" />
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc', marginTop: 16 }}>
            Drop KML / KMZ / Excel file here
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 8 }}>
            File will be automatically imported & rendered on the map
          </div>
        </div>
      )}
      {isLoaded && <SearchBox onPlaceSelected={handlePlaceSelected} />}

      {appMode === 'edit' && (
        <ProjectsPanel
          onAddProject={() => drawingManagerRef.current?.startDrawing()}
          onAddLandmark={handleStartAddLandmark}
        />
      )}
      <FilterBar />
      <RightActionDock />
      <WhatsAppCTA />
      <PropertyInfoPanel />

      {landmarkModalPos && (
        <AddLandmarkModal
          position={landmarkModalPos}
          onClose={() => setLandmarkModalPos(null)}
        />
      )}

      {isLoaded && (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={13}
          onLoad={handleMapLoad}
          onUnmount={() => setMap(null)}
          onClick={(e) => {
            if (isPlacingLandmark && e.latLng) {
              setLandmarkModalPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              setIsPlacingLandmark(false);
              return;
            }
            // Deselect any selected polygon and close panel when clicking on the map
            const appModeObj = useMapStore.getState();
            if (appModeObj.selectedFeatureId) {
              appModeObj.setSelectedFeatureId(null);
            }
            appModeObj.setIsInfoPanelOpen(false);
            setSearchMarkerPos(null);
          }}
          options={{
            gestureHandling: 'greedy',
            backgroundColor: '#000000',
            disableDefaultUI: true, // we use custom zoom control now
            zoomControl: false, // disable native zoom control
            mapTypeId: showLabels ? 'hybrid' : 'satellite',
            tilt: 0,
            minZoom: 9,
            restriction: {
              latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
              strictBounds: true
            }
          }}
        >
          <FeatureInstanceManager />
          <LandmarkManager />

          {searchMarkerPos && (
            <Marker
              position={searchMarkerPos}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
              }}
              animation={window.google?.maps?.Animation?.DROP}
            />
          )}

          <PolygonDrawingManager
            ref={drawingManagerRef}
            map={map}
            appMode={appMode}
            onPolygonComplete={handlePolygonComplete}
          />
        </GoogleMap>
      )}
    </div>
  );
}
