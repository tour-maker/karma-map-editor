import { useEffect, useRef, useCallback } from 'react';
import { useMapStore } from '../store/useMapStore';
import { useGoogleMap } from '../context/GoogleMapContext';

const geocodeCache = new Map();

// Helper to strip leading symbols/punctuation and guiding words like 'near', 'nr.', 'b/h', 'opp.', 'opposite', 'behind'
export function cleanLandmarkTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return '';
  let str = rawTitle.trim();

  // Strip leading non-alphanumeric noise (like "..", ", ", "- ", "_ ")
  str = str.replace(/^[^a-zA-Z0-9]+/, '').trim();

  // Pattern matching guiding prefix words
  const prefixRegex = /^(?:nr|near|b\/h|b\.h\.|bh|opp|opposite|adj|adjacent|behind|next\s+to)[\s\.,:-]+/i;

  let previous = '';
  while (str !== previous) {
    previous = str;
    str = str.replace(/^[^a-zA-Z0-9]+/, '').trim();
    str = str.replace(prefixRegex, '').trim();
  }

  // Strip trailing punctuation/noise
  str = str.replace(/^[^a-zA-Z0-9]+/, '').replace(/[\s\.,:-]+$/, '').trim();

  if (str.length > 0) {
    str = str.charAt(0).toUpperCase() + str.slice(1);
  }

  return str;
}

export async function resolveLandmarkLocation(landmark, fallbackCenter) {
  if (!landmark || !landmark.trim()) return null;
  const cleanLandmark = cleanLandmarkTitle(landmark);
  const cacheKey = cleanLandmark.toLowerCase();

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  if (!window.google?.maps?.Geocoder) return null;

  const geocoder = new window.google.maps.Geocoder();

  let query = cleanLandmark;
  if (!cleanLandmark.toLowerCase().includes('surat') && !cleanLandmark.toLowerCase().includes('gujarat')) {
    query = `${cleanLandmark}, Surat, Gujarat`;
  }

  const request = { address: query };
  if (fallbackCenter) {
    const lat = typeof fallbackCenter.lat === 'function' ? fallbackCenter.lat() : fallbackCenter.lat;
    const lng = typeof fallbackCenter.lng === 'function' ? fallbackCenter.lng() : fallbackCenter.lng;
    if (lat && lng) {
      request.location = new window.google.maps.LatLng(lat, lng);
    }
  }

  return new Promise((resolve) => {
    geocoder.geocode(request, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        const pos = { lat: loc.lat(), lng: loc.lng() };
        geocodeCache.set(cacheKey, pos);
        resolve(pos);
      } else {
        geocoder.geocode({ address: cleanLandmark }, (res2, stat2) => {
          if (stat2 === 'OK' && res2 && res2[0]) {
            const loc2 = res2[0].geometry.location;
            const pos2 = { lat: loc2.lat(), lng: loc2.lng() };
            geocodeCache.set(cacheKey, pos2);
            resolve(pos2);
          } else {
            geocodeCache.set(cacheKey, null);
            resolve(null);
          }
        });
      }
    });
  });
}

function doBoxesOverlap(boxA, boxB, padding = 6) {
  return !(
    boxA.right + padding < boxB.left ||
    boxA.left - padding > boxB.right ||
    boxA.bottom + padding < boxB.top ||
    boxA.top - padding > boxB.bottom
  );
}

function createLandmarkOverlay(map, position, titles, count = 1, featureIds = [], onClick) {
  if (!window.google?.maps?.OverlayView) return null;

  class LandmarkOverlayView extends window.google.maps.OverlayView {
    constructor(pos, titlesList, itemCount, featIds) {
      super();
      this.pos = pos;
      this.titles = Array.isArray(titlesList) ? titlesList.map(t => cleanLandmarkTitle(t)) : [cleanLandmarkTitle(titlesList)];
      this.primaryTitle = this.titles[0] || 'Landmark';
      this.count = itemCount || this.titles.length;
      this.featureIds = featIds || [];
      this.container = null;
      this.mode = 'full'; // 'full' | 'compact'
      this.isVisible = true;
      this.isHovered = false;
      this.pixelPos = null;
      this.baseZIndex = 50;
    }

    onAdd() {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.cursor = 'pointer';
      div.style.transform = 'translate(-50%, -100%)';
      div.style.zIndex = String(this.baseZIndex);
      div.style.pointerEvents = 'auto';
      div.style.transition = 'opacity 0.15s ease';

      div.addEventListener('mouseenter', () => {
        this.isHovered = true;
        div.style.zIndex = '999999';
        this.renderContent(true);
      });

      div.addEventListener('mouseleave', () => {
        this.isHovered = false;
        div.style.zIndex = String(this.baseZIndex);
        this.renderContent(false);
      });

      if (onClick) {
        div.addEventListener('click', (e) => {
          e.stopPropagation();
          onClick();
        });
      }

      this.container = div;
      this.renderContent(false);

      const panes = this.getPanes();
      if (panes?.overlayMouseTarget) {
        panes.overlayMouseTarget.appendChild(div);
      } else if (panes?.overlayLayer) {
        panes.overlayLayer.appendChild(div);
      }
    }

    setMode(newMode) {
      if (this.mode === newMode) return;
      this.mode = newMode;
      this.renderContent(this.isHovered);
    }

    setVisible(visible) {
      this.isVisible = visible;
      if (this.container) {
        this.container.style.display = visible ? 'block' : 'none';
      }
    }

    setBaseZIndex(zIndex) {
      this.baseZIndex = zIndex;
      if (this.container && !this.isHovered) {
        this.container.style.zIndex = String(zIndex);
      }
    }

    renderContent(isExpandedHover = false) {
      if (!this.container) return;

      const extraCount = this.titles.length > 1 ? this.titles.length - 1 : 0;
      const badgeText = this.count > 1 ? `${this.count}` : (extraCount > 0 ? `+${extraCount}` : '');

      let tooltipHtml = '';
      if (isExpandedHover && this.titles.length > 1) {
        tooltipHtml = `
          <div style="
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            margin-bottom: 6px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(148, 163, 184, 0.4);
            border-radius: 8px;
            padding: 6px 10px;
            color: #f8fafc;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            pointer-events: none;
            z-index: 1000000;
            display: flex;
            flex-direction: column;
            gap: 3px;
          ">
            ${this.titles.map(t => `<div>• ${t}</div>`).join('')}
          </div>
        `;
      }

      if (this.mode === 'compact' && !isExpandedHover) {
        this.container.innerHTML = `
          <div title="${this.titles.join(', ')}" style="
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 2px;
            background: rgba(30, 41, 59, 0.65);
            backdrop-filter: blur(4px);
            border: 1px solid rgba(148, 163, 184, 0.2);
            padding: 2px 5px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: all 0.15s ease;
            opacity: 0.65;
            transform: scale(0.9);
          ">
            <svg width="10" height="12" viewBox="0 0 24 24" fill="#94a3b8" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        `;
      } else {
        const maxWidth = isExpandedHover ? '260px' : '110px';
        const transform = isExpandedHover ? 'scale(1.08)' : 'scale(1)';

        this.container.innerHTML = `
          <div style="
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: ${isExpandedHover ? 'rgba(15, 23, 42, 0.95)' : 'rgba(30, 41, 59, 0.78)'};
            backdrop-filter: blur(4px);
            border: 1px solid ${isExpandedHover ? 'rgba(148, 163, 184, 0.5)' : 'rgba(148, 163, 184, 0.32)'};
            padding: 2px 7px 2px 5px;
            border-radius: 12px;
            box-shadow: ${isExpandedHover ? '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.35)'};
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 10px;
            font-weight: 500;
            color: ${isExpandedHover ? '#ffffff' : '#e2e8f0'};
            opacity: ${isExpandedHover ? '1' : '0.85'};
            white-space: nowrap;
            user-select: none;
            transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
            transform: ${transform};
          ">
            ${tooltipHtml}
            <svg width="10" height="12" viewBox="0 0 24 24" fill="${isExpandedHover ? '#38bdf8' : '#94a3b8'}" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span style="
              max-width: ${maxWidth};
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              display: inline-block;
            ">${this.primaryTitle}</span>
          </div>
        `;
      }
    }

    draw() {
      if (!this.container || !this.pos) return;
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(this.pos);
      if (point) {
        this.pixelPos = point;
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

  const overlay = new LandmarkOverlayView(position, titles, count, featureIds);
  overlay.setMap(map);
  return overlay;
}

export default function LandmarkManager() {
  const map = useGoogleMap();
  const features = useMapStore(state => state.features);
  const showLandmarks = useMapStore(state => state.showLandmarks);
  const setSelectedFeatureId = useMapStore(state => state.setSelectedFeatureId);
  const setIsInfoPanelOpen = useMapStore(state => state.setIsInfoPanelOpen);

  const landmarkOverlaysRef = useRef(new Map()); // clusterKey -> { overlay, cluster }

  // Perform 2D AABB bounding box collision detection & adaptive mode / occlusion hiding
  const updateOverlaysState = useCallback(() => {
    if (!map) return;
    if (!useMapStore.getState().showLandmarks) {
      landmarkOverlaysRef.current.forEach(item => {
        if (item.overlay) item.overlay.setVisible(false);
      });
      return;
    }

    const zoom = map.getZoom();
    const isZoomedOut = zoom != null && zoom < 12;

    const items = Array.from(landmarkOverlaysRef.current.values());

    // Sort by latitude (north to south) so southern elements layer over northern elements
    items.sort((a, b) => (b.cluster?.pos?.lat || 0) - (a.cluster?.pos?.lat || 0));

    const activePlacedBoxes = []; // Array of placed bounding boxes

    items.forEach((item, index) => {
      if (!item.overlay) return;
      item.overlay.setBaseZIndex(10 + index);

      const p = item.overlay.pixelPos;
      if (!p || isZoomedOut) {
        item.overlay.setVisible(false);
        return;
      }

      // Zoomed in: show full landmark name badge if space allows without colliding, otherwise hide completely
      const fullBox = {
        left: p.x - 80,
        right: p.x + 80,
        top: p.y - 32,
        bottom: p.y + 4
      };

      const isCollidingFull = activePlacedBoxes.some((b) => doBoxesOverlap(fullBox, b, 8));

      if (!isCollidingFull) {
        item.overlay.setMode('full');
        item.overlay.setVisible(true);
        activePlacedBoxes.push(fullBox);
      } else {
        // If full badge collides, hide completely (no small pin)
        item.overlay.setVisible(false);
      }
    });
  }, [map]);

  // Bind map listeners for zoom & pan changes
  useEffect(() => {
    if (!map) return;

    const listenerZoom = map.addListener('zoom_changed', updateOverlaysState);
    const listenerIdle = map.addListener('idle', updateOverlaysState);
    const listenerBounds = map.addListener('bounds_changed', updateOverlaysState);

    return () => {
      if (window.google?.maps?.event) {
        window.google.maps.event.removeListener(listenerZoom);
        window.google.maps.event.removeListener(listenerIdle);
        window.google.maps.event.removeListener(listenerBounds);
      }
    };
  }, [map, updateOverlaysState]);

  useEffect(() => {
    if (!map) return;

    // Clear all existing overlays before re-processing to remove old cached overlays
    landmarkOverlaysRef.current.forEach(item => {
      if (item.overlay) item.overlay.setMap(null);
    });
    landmarkOverlaysRef.current.clear();

    // If landmarks toggle is turned OFF, return
    if (!showLandmarks) {
      return;
    }

    // Process landmarks across features (both property landmark notes and dedicated landmarks)
    const landmarkItemMap = new Map(); // key -> { landmarkText, featureId, center, count, fixedPos }

    features.forEach(feature => {
      const isDedicatedLandmark = feature.id?.startsWith('landmark-') || feature.data?.type === 'Landmark';
      const rawText = feature.data?.landmark?.trim() || (isDedicatedLandmark ? (feature.data?.name?.trim() || 'Landmark') : '');
      if (!rawText) return;
      const landmarkText = cleanLandmarkTitle(rawText);
      if (!landmarkText) return;
      const key = landmarkText.toLowerCase();

      const pos = isDedicatedLandmark ? (feature.position || feature.center) : null;

      if (!landmarkItemMap.has(key)) {
        landmarkItemMap.set(key, {
          landmarkText,
          featureId: feature.id,
          center: feature.center || feature.position,
          fixedPos: pos,
          count: 1
        });
      } else {
        const item = landmarkItemMap.get(key);
        item.count += 1;
        if (!item.fixedPos && pos) {
          item.fixedPos = pos;
        }
      }
    });

    const processClusters = async () => {
      // Resolve geocode coordinates for active landmarks (or use fixedPos directly)
      const geocodedItems = [];
      for (const item of landmarkItemMap.values()) {
        const pos = item.fixedPos || (await resolveLandmarkLocation(item.landmarkText, item.center));
        if (pos) {
          geocodedItems.push({ ...item, pos });
        }
      }

      if (!useMapStore.getState().showLandmarks) return;

      // Group geocoded items that are within ~18 meters (0.00018 deg lat/lng) into a single spatial cluster
      const clusters = [];
      for (const item of geocodedItems) {
        let matchedCluster = null;
        for (const c of clusters) {
          const latDiff = Math.abs(c.pos.lat - item.pos.lat);
          const lngDiff = Math.abs(c.pos.lng - item.pos.lng);
          if (latDiff < 0.00018 && lngDiff < 0.00018) {
            matchedCluster = c;
            break;
          }
        }

        if (matchedCluster) {
          if (!matchedCluster.titles.includes(item.landmarkText)) {
            matchedCluster.titles.push(item.landmarkText);
          }
          matchedCluster.featureIds.push(item.featureId);
          matchedCluster.count += item.count;
        } else {
          clusters.push({
            key: `cluster-${item.pos.lat.toFixed(5)}-${item.pos.lng.toFixed(5)}`,
            pos: item.pos,
            titles: [item.landmarkText],
            featureIds: [item.featureId],
            count: item.count
          });
        }
      }

      const activeClusterKeys = new Set(clusters.map(c => c.key));

      // Remove overlays for clusters that no longer exist
      landmarkOverlaysRef.current.forEach((item, clusterKey) => {
        if (!activeClusterKeys.has(clusterKey)) {
          if (item.overlay) item.overlay.setMap(null);
          landmarkOverlaysRef.current.delete(clusterKey);
        }
      });

      // Create/update overlays for each spatial cluster
      clusters.forEach((cluster) => {
        if (landmarkOverlaysRef.current.has(cluster.key)) return;

        const overlay = createLandmarkOverlay(
          map,
          cluster.pos,
          cluster.titles,
          cluster.count,
          cluster.featureIds,
          () => {
            map.panTo(cluster.pos);
          }
        );

        if (overlay) {
          landmarkOverlaysRef.current.set(cluster.key, {
            overlay,
            cluster
          });
        }
      });

      updateOverlaysState();
    };

    processClusters();

  }, [features, map, showLandmarks, setSelectedFeatureId, setIsInfoPanelOpen, updateOverlaysState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      landmarkOverlaysRef.current.forEach(item => {
        if (item.overlay) item.overlay.setMap(null);
      });
      landmarkOverlaysRef.current.clear();
    };
  }, []);

  return null;
}

