import React, { useMemo } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { CATEGORY_MAP } from '../../config/categories';

export default function TopStatsBar() {
  const uiHidden = useMapStore(state => state.uiHidden);
  const features = useMapStore(state => state.features);
  const kmlLayers = useMapStore(state => state.kmlLayers);
  const filterPrimary = useMapStore(state => state.filterPrimary);
  const filterSecondary = useMapStore(state => state.filterSecondary);
  const filterType = useMapStore(state => state.filterType);

  let locationText = 'All Locations';
  if (filterSecondary) {
    locationText = filterSecondary;
  } else if (filterPrimary) {
    locationText = filterPrimary;
  }

  const visibleCount = useMemo(() => {
    const visibleLayerIds = new Set(kmlLayers.filter(l => l.visible).map(l => l.id));
    
    return features.reduce((count, feature) => {
      // Exclude dedicated landmarks from Property count
      if (feature.id?.startsWith('landmark-') || feature.data?.type === 'Landmark') {
        return count;
      }

      let isVisible = true;
      if (feature.source === 'kml' && feature.layerId) {
        isVisible = visibleLayerIds.has(feature.layerId);
      }

      if (isVisible && (filterPrimary || filterSecondary)) {
        const loc = feature.data?.location;
        if (filterSecondary) {
          if (loc !== filterSecondary) isVisible = false;
        } else if (filterPrimary) {
          const validLocations = [filterPrimary, ...(CATEGORY_MAP[filterPrimary] || [])];
          if (!validLocations.includes(loc)) isVisible = false;
        }
      }

      if (isVisible && filterType) {
        if (feature.data?.type !== filterType) isVisible = false;
      }
      
      if (isVisible && feature.style?.visible !== false) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [features, kmlLayers, filterPrimary, filterSecondary, filterType]);

  if (uiHidden) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      background: 'rgba(15, 23, 42, 0.92)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: 999,
      padding: '8px 32px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
      color: 'white',
      fontFamily: 'sans-serif',
      minWidth: '280px',
      justifyContent: 'center',
      gap: 32
    }}>
      
      <div style={{
        fontSize: 20,
        fontWeight: 700,
        color: '#818cf8',
        textShadow: '0 2px 10px rgba(129, 140, 248, 0.4)'
      }}>
        {locationText}
      </div>

      <div style={{
        width: 1,
        height: 32,
        background: '#818cf8',
        opacity: 0.5
      }} />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1
      }}>
        <div style={{
          fontSize: 22,
          fontWeight: 800,
          color: '#818cf8',
          marginBottom: 4,
          textShadow: '0 2px 10px rgba(129, 140, 248, 0.4)'
        }}>
          {visibleCount}
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#cbd5e1',
          textTransform: 'uppercase',
          letterSpacing: 1
        }}>
          properties
        </div>
      </div>
      
    </div>
  );
}
