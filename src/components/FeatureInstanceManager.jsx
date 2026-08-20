import { useEffect, useRef } from 'react';
import { useMapStore } from '../store/useMapStore';
import { useGoogleMap } from '../context/GoogleMapContext';
import { createImportedMarker, createImportedPolygon, highlightPolygon, zoomToProperty, getCategoryPinIcon, calculatePolygonCenter } from '../services/googleMaps';
import { getPropertyTypeColor, DEFAULT_PROPERTY_COLOR, CATEGORY_MAP } from '../config/categories';

// Inject Keyframes for Selected Pin Glow Effect
if (typeof document !== 'undefined' && !document.getElementById('selected-pin-glow-keyframes')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'selected-pin-glow-keyframes';
  styleEl.innerHTML = `
    @keyframes radarPulse {
      0% { transform: scale(0.4); opacity: 0.7; }
      100% { transform: scale(1.4); opacity: 0; }
    }
    @keyframes glowPulseCore {
      0% { transform: scale(0.85); opacity: 0.35; }
      100% { transform: scale(1.15); opacity: 0.65; }
    }
  `;
  document.head.appendChild(styleEl);
}

// Custom OverlayView for glowing pulse radar effect around selected feature pin
function createSelectedGlowOverlay(map, position, color = '#3b82f6') {
  if (!window.google?.maps?.OverlayView) return null;

  class SelectedGlowOverlayView extends window.google.maps.OverlayView {
    constructor(pos, glowColor) {
      super();
      this.pos = pos;
      this.glowColor = glowColor;
      this.container = null;
    }

    onAdd() {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.pointerEvents = 'none';
      div.style.zIndex = '999';

      const color = this.glowColor;
      div.innerHTML = `
        <div style="position: relative; width: 0; height: 0;">
          <!-- Soft Radar Pulse Ring -->
          <div style="
            position: absolute;
            top: 50%; left: 50%;
            width: 56px; height: 56px;
            margin-top: -28px; margin-left: -28px;
            border-radius: 50%;
            border: 1.5px solid ${color};
            box-shadow: 0 0 10px ${color};
            animation: radarPulse 2s infinite cubic-bezier(0, 0.2, 0.8, 1);
          "></div>
          <!-- Soft Core Ambient Disc -->
          <div style="
            position: absolute;
            top: 50%; left: 50%;
            width: 32px; height: 32px;
            margin-top: -16px; margin-left: -16px;
            border-radius: 50%;
            background: radial-gradient(circle, ${color} 0%, rgba(59, 130, 246, 0.02) 80%);
            box-shadow: 0 0 12px 2px ${color};
            animation: glowPulseCore 1.5s infinite ease-in-out alternate;
          "></div>
        </div>
      `;

      this.container = div;
      const panes = this.getPanes();
      if (panes?.overlayLayer) {
        panes.overlayLayer.appendChild(div);
      }
    }

    draw() {
      if (!this.container || !this.pos) return;
      const projection = this.getProjection();
      if (!projection) return;

      const lat = typeof this.pos.lat === 'function' ? this.pos.lat() : this.pos.lat;
      const lng = typeof this.pos.lng === 'function' ? this.pos.lng() : this.pos.lng;
      const latLng = new window.google.maps.LatLng(lat, lng);

      const point = projection.fromLatLngToDivPixel(latLng);
      if (point) {
        this.container.style.left = point.x + 'px';
        this.container.style.top = point.y + 'px';
      }
    }

    onRemove() {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
        this.container = null;
      }
    }
  }

  const overlay = new SelectedGlowOverlayView(position, color);
  overlay.setMap(map);
  return overlay;
}

// A KML polygon that absorbed Excel data via "Map Pins" gets this color
// if no category is assigned, so matched vs. unmatched polygons are distinguishable.
const MATCHED_KML_COLOR = '#16a34a';

function isMatchedKmlPolygon(feature) {
  return feature.source === 'kml' && feature.type === 'polygon' && Boolean(feature.data?.matchTier);
}

function getFeatureColor(feature) {
  if (feature.data?.type) {
    return getPropertyTypeColor(feature.data.type);
  }
  if (isMatchedKmlPolygon(feature)) {
    return MATCHED_KML_COLOR;
  }
  return feature.style?.fillColor || feature.style?.strokeColor || DEFAULT_PROPERTY_COLOR;
}

function getPolygonColors(feature) {
  const color = getFeatureColor(feature);
  return { fillColor: color, strokeColor: color };
}

export default function FeatureInstanceManager() {
  const map = useGoogleMap();
  const features = useMapStore(state => state.features);
  const selectedFeatureId = useMapStore(state => state.selectedFeatureId);
  const setSelectedFeatureId = useMapStore(state => state.setSelectedFeatureId);
  const setIsInfoPanelOpen = useMapStore(state => state.setIsInfoPanelOpen);
  const setFeatureInstances = useMapStore(state => state.setFeatureInstances);

  const processedFeatureIds = useRef(new Set());
  const listenersRef = useRef(new Map());
  const instancesMapRef = useRef(new Map());

  // Create instances for features that don't have them (imported features)
  useEffect(() => {
    if (!map) return;

    features.forEach(feature => {
      // Ignore landmark features — LandmarkManager renders them as slate gray landmark tags
      if (feature.id?.startsWith('landmark-') || feature.data?.type === 'Landmark') {
        return;
      }

      // Ignore unmapped KML polygons/markers
      if (feature.source === 'kml' && !feature.data?.matchTier) {
        return;
      }

      const d = feature.data || {};
      const hasContent = Boolean(
        (d.location && d.location.trim()) ||
        (d.parentLocation && d.parentLocation.trim()) ||
        (d.name && d.name !== 'polygon' && d.name !== 'marker' && d.name.trim()) ||
        (d.tp && d.tp.trim()) ||
        (d.op && d.op.trim()) ||
        (d.fp && d.fp.trim()) ||
        (d.landmark && d.landmark.trim()) ||
        (d.area != null && d.area !== '')
      );

      if (!hasContent) return;

      // If we've already processed this feature, or if it already has instances, skip.
      if (processedFeatureIds.current.has(feature.id) || feature.instances?.polygon || feature.instances?.marker) {
        return;
      }

      let polygon = null;
      let marker = null;
      const listeners = [];
      const handleSelect = () => {
        const state = useMapStore.getState();
        if (state.selectedFeatureId === feature.id && state.isInfoPanelOpen) {
          state.setSelectedFeatureId(null);
          state.setIsInfoPanelOpen(false);
        } else {
          setSelectedFeatureId(feature.id);
          setIsInfoPanelOpen(true);
          if (map) {
            zoomToProperty(map, feature);
          }
        }
      };

      if (feature.type === 'polygon' && feature.coordinates) {
        const colors = getPolygonColors(feature);
        polygon = createImportedPolygon(map, feature.coordinates, {
          fillColor: colors.fillColor,
          fillOpacity: feature.style?.fillOpacity,
          strokeColor: colors.strokeColor,
          strokeWeight: feature.style?.strokeWeight,
          visible: feature.style?.visible !== false
        });
        if (polygon) {
          listeners.push(window.google.maps.event.addListener(polygon, 'click', handleSelect));
        }

        // Always draw a marker at the center of the polygon, unless specifically hidden
        if (feature.center && !feature.data?.extendedData?.hideCenterMarker) {
          const pinColor = getFeatureColor(feature);
          marker = createImportedMarker(map, feature.center, {
            title: feature.data?.name || 'Polygon',
            visible: feature.style?.visible !== false,
            icon: getCategoryPinIcon(pinColor)
          });
          if (marker) {
            listeners.push(window.google.maps.event.addListener(marker, 'click', handleSelect));
          }
        }
      } else if (feature.type === 'marker' && feature.position) {
        const pinColor = getFeatureColor(feature);
        marker = createImportedMarker(map, feature.position, {
          title: feature.data?.name,
          visible: feature.style?.visible !== false,
          icon: getCategoryPinIcon(pinColor)
        });
        if (marker) {
          listeners.push(window.google.maps.event.addListener(marker, 'click', handleSelect));
        }
      }

      if (polygon || marker) {
        setFeatureInstances(feature.id, polygon, marker);
        listenersRef.current.set(feature.id, listeners);
        instancesMapRef.current.set(feature.id, { polygon, marker, listeners });
        processedFeatureIds.current.add(feature.id);
      }
    });

  }, [features, map, setSelectedFeatureId, setFeatureInstances]);

  // Clean up removed features
  useEffect(() => {
    const currentFeatureIds = new Set(features.map(f => f.id));

    processedFeatureIds.current.forEach(id => {
      if (!currentFeatureIds.has(id)) {
        // Feature was removed — unmount Google Maps instances
        const inst = instancesMapRef.current.get(id);
        if (inst) {
          if (inst.polygon) inst.polygon.setMap(null);
          if (inst.marker) inst.marker.setMap(null);
          if (Array.isArray(inst.listeners)) {
            inst.listeners.forEach(l => window.google?.maps?.event?.removeListener(l));
          }
          instancesMapRef.current.delete(id);
        }
        const listeners = listenersRef.current.get(id);
        if (listeners) {
          listeners.forEach(l => window.google?.maps?.event?.removeListener(l));
          listenersRef.current.delete(id);
        }
        processedFeatureIds.current.delete(id);
      }
    });
  }, [features]);

  // Sync styles
  useEffect(() => {
    features.forEach(feature => {
      const colors = getPolygonColors(feature);
      if (feature.instances?.polygon) {
        feature.instances.polygon.setOptions({
          fillColor: colors.fillColor,
          strokeColor: colors.strokeColor,
          fillOpacity: 0.55,
          strokeWeight: 2
        });
      }
      if (feature.instances?.marker) {
        const pinColor = getFeatureColor(feature);
        if (window.google?.maps) {
          feature.instances.marker.setIcon(getCategoryPinIcon(pinColor));
        }
      }
    });
  }, [features]);


  // Handle Visibility (KML Layers & Filters)
  const kmlLayers = useMapStore(state => state.kmlLayers);
  const filterPrimary = useMapStore(state => state.filterPrimary);
  const filterSecondary = useMapStore(state => state.filterSecondary);
  const filterType = useMapStore(state => state.filterType);

  useEffect(() => {
    const visibleLayerIds = new Set(kmlLayers.filter(l => l.visible).map(l => l.id));

    features.forEach(feature => {
      if (!feature.instances) return;

      // Determine base visibility from KML layers
      let isVisible = true;
      if (feature.source === 'kml' && feature.layerId) {
        isVisible = visibleLayerIds.has(feature.layerId);
      }

      // Apply Primary & Secondary Location Filter
      if (isVisible && (filterPrimary || filterSecondary)) {
        const loc = feature.data?.location;

        if (filterSecondary) {
          // If secondary is selected (e.g. Adajan), it must match exactly
          if (loc !== filterSecondary) {
            isVisible = false;
          }
        } else if (filterPrimary) {
          // If only primary is selected (e.g. Surat), it must be the primary city itself OR one of its sub-locations
          const validLocations = [filterPrimary, ...(CATEGORY_MAP[filterPrimary] || [])];
          if (!validLocations.includes(loc)) {
            isVisible = false;
          }
        }
      }

      // Apply Type Filter
      if (isVisible && filterType) {
        const type = feature.data?.type;
        if (type !== filterType) {
          isVisible = false;
        }
      }

      if (feature.instances.polygon) {
        // Only override if style allows visible
        const finalVisible = isVisible && feature.style?.visible !== false;
        feature.instances.polygon.setVisible(finalVisible);
      }
      if (feature.instances.marker) {
        const finalVisible = isVisible && feature.style?.visible !== false;
        feature.instances.marker.setVisible(finalVisible);
      }
    });
  }, [kmlLayers, features, filterPrimary, filterSecondary, filterType]);

  // Handle Highlighting & Glowing Bouncing Pin
  const previousSelectedIdRef = useRef(null);
  const selectedGlowOverlayRef = useRef(null);

  useEffect(() => {
    const prevId = previousSelectedIdRef.current;

    if (prevId != null && prevId !== selectedFeatureId) {
      const prevFeature = features.find(f => f.id === prevId);
      if (prevFeature?.instances?.polygon) {
        const color = getFeatureColor(prevFeature);
        highlightPolygon(prevFeature.instances.polygon, false, color);
        prevFeature.instances.polygon.setEditable(false);
      }
      if (prevFeature?.instances?.marker) {
        prevFeature.instances.marker.setAnimation(null);
      }
    }

    // Clean up previous glow overlay
    if (selectedGlowOverlayRef.current) {
      selectedGlowOverlayRef.current.setMap(null);
      selectedGlowOverlayRef.current = null;
    }

    if (selectedFeatureId != null && map) {
      const currentFeature = features.find(f => f.id === selectedFeatureId);
      if (currentFeature?.instances?.polygon) {
        const color = getFeatureColor(currentFeature);
        highlightPolygon(currentFeature.instances.polygon, true, color);
      }

      if (currentFeature) {
        if (currentFeature.instances?.marker && window.google?.maps?.Animation) {
          currentFeature.instances.marker.setAnimation(window.google.maps.Animation.BOUNCE);
        }

        // Find pin position for glow overlay
        let pos = currentFeature.position || currentFeature.center;
        if (!pos && currentFeature.coordinates && currentFeature.coordinates.length >= 3) {
          pos = calculatePolygonCenter(currentFeature.coordinates);
        }

        if (pos) {
          const color = getFeatureColor(currentFeature);
          const glowOverlay = createSelectedGlowOverlay(map, pos, color);
          selectedGlowOverlayRef.current = glowOverlay;
        }
      }
    }

    previousSelectedIdRef.current = selectedFeatureId;
  }, [selectedFeatureId, features, map]);

  return null;
}
