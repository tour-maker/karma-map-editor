import { useMapStore } from '../../store/useMapStore';
import { useGoogleMap } from '../../context/GoogleMapContext';
import { FiPlus, FiMinus } from 'react-icons/fi';

export default function CustomZoomControl() {
  const map = useGoogleMap();
  const theme = useMapStore(state => state.theme);
  
  const isDark = theme === 'dark';
  const bg = isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255,255,255,0.9)';
  const border = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.5)';
  const color = isDark ? '#94a3b8' : '#64748b';
  const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

  const handleZoomIn = () => {
    if (map) map.setZoom((map.getZoom() || 10) + 1);
  };

  const handleZoomOut = () => {
    if (map) map.setZoom((map.getZoom() || 10) - 1);
  };

  return (
    <div style={{
      position: 'absolute',
      right: 20,
      bottom: 30,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      background: bg,
      borderRadius: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      backdropFilter: 'blur(8px)',
      border: border,
      overflow: 'hidden'
    }}>
      <button
        onClick={handleZoomIn}
        style={{
          border: 'none', background: 'transparent', padding: '10px',
          cursor: 'pointer', color, display: 'flex', alignItems: 'center',
          justifyContent: 'center', transition: 'background 0.2s',
          borderBottom: border
        }}
        onMouseOver={e => e.currentTarget.style.background = hoverBg}
        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
      >
        <FiPlus size={18} />
      </button>
      <button
        onClick={handleZoomOut}
        style={{
          border: 'none', background: 'transparent', padding: '10px',
          cursor: 'pointer', color, display: 'flex', alignItems: 'center',
          justifyContent: 'center', transition: 'background 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.background = hoverBg}
        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
      >
        <FiMinus size={18} />
      </button>
    </div>
  );
}
