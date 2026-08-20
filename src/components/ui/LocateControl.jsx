import { useMapStore } from '../../store/useMapStore';
import { useGoogleMap } from '../../context/GoogleMapContext';
import { FiNavigation } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useState } from 'react';

export default function LocateControl() {
  const map = useGoogleMap();
  const theme = useMapStore(state => state.theme);
  const [isLocating, setIsLocating] = useState(false);
  
  const isDark = theme === 'dark';
  const bg = isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255,255,255,0.9)';
  const border = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.5)';
  const color = isLocating ? '#3b82f6' : (isDark ? '#94a3b8' : '#64748b');
  const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

  const handleLocate = () => {
    if (!map) return;
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        map.panTo(pos);
        map.setZoom(16);
        toast.success('Location found');
      },
      () => {
        setIsLocating(false);
        toast.error('Unable to retrieve your location');
      },
      { timeout: 10000 }
    );
  };

  return (
    <div style={{
      position: 'absolute',
      right: 20,
      bottom: 110,
      zIndex: 1000,
      display: 'flex',
      background: bg,
      borderRadius: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      backdropFilter: 'blur(8px)',
      border: border,
      overflow: 'hidden'
    }}>
      <button
        onClick={handleLocate}
        title="Find my location"
        style={{
          border: 'none', background: 'transparent', padding: '10px',
          cursor: 'pointer', color, display: 'flex', alignItems: 'center',
          justifyContent: 'center', transition: 'all 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.background = hoverBg}
        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
      >
        <FiNavigation size={18} style={{ transform: isLocating ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s' }} />
      </button>
    </div>
  );
}
