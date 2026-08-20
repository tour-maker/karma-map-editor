import { useMemo } from 'react';
import { OverlayView } from '@react-google-maps/api';
import { FiEdit2, FiInfo, FiTrash2 } from 'react-icons/fi';
import { useMapStore } from '../store/useMapStore';

function FloatingPolygonToolbar({
  polygon,
  onEdit,
  onDelete
}) {
  const appMode = useMapStore(state => state.appMode);
  const setIsInfoPanelOpen = useMapStore(state => state.setIsInfoPanelOpen);
  const theme = useMapStore(state => state.theme);

  if (!polygon || !polygon.center) return null;

  const isEdit = appMode === 'edit';
  const isDark = theme === 'dark';

  const handleInfo = () => {
    setIsInfoPanelOpen(true);
  };

  const measurements = useMemo(() => {
    if (!polygon.coordinates || !window.google?.maps?.geometry?.spherical) return null;
    const path = polygon.coordinates.map(c => new window.google.maps.LatLng(c.lat, c.lng));
    const areaSqMeters = window.google.maps.geometry.spherical.computeArea(path);
    const perimeterMeters = window.google.maps.geometry.spherical.computeLength(path);
    
    return {
      area: (areaSqMeters * 1.19599).toFixed(2), // Convert sq meters to sq yards
      perimeter: (perimeterMeters * 1.09361).toFixed(2), // Convert meters to yards
    };
  }, [polygon.coordinates]);

  const bg = isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const border = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.5)';
  const textColor = isDark ? '#f8fafc' : '#475569';

  return (
    <OverlayView
      position={polygon.center}
      mapPaneName={OverlayView.FLOAT_PANE}
      getPixelPositionOffset={(width, height) => ({
        x: -(width / 2),
        y: 10, // Positioned slightly below the center
      })}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 6,
            background: bg,
            padding: '6px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            backdropFilter: 'blur(8px)',
            border: border,
            width: 'max-content',
          }}
        >
          {isEdit && (
            <button
              onClick={() => onEdit?.(polygon.id)}
              title="Edit Polygon"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
                color: '#3b82f6', transition: 'background 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <FiEdit2 size={16} />
            </button>
          )}

        <button
          onClick={handleInfo}
          title="Property Info"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
            color: '#10b981', transition: 'background 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#ecfdf5'}
          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        >
          <FiInfo size={16} />
        </button>

        {isEdit && (
          <button
            onClick={() => onDelete?.(polygon.id)}
            title="Delete Polygon"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer', padding: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
              color: '#ef4444', transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <FiTrash2 size={16} />
          </button>
        )}
        </div>
        {measurements && (
          <div style={{
            background: bg,
            color: textColor,
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            backdropFilter: 'blur(8px)',
            border: border,
            whiteSpace: 'nowrap'
          }}>
            {measurements.area} yd² | {measurements.perimeter} yd
          </div>
        )}
      </div>
    </OverlayView>
  );
}

export default FloatingPolygonToolbar;
