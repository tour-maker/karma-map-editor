import { useMapStore } from '../../store/useMapStore';
import { useStore } from 'zustand';
import { FiSun, FiMoon, FiRotateCcw, FiRotateCw, FiEye, FiEyeOff, FiMap, FiMapPin } from 'react-icons/fi';

export default function ModeToggle() {
  const appMode = useMapStore(state => state.appMode);
  const setAppMode = useMapStore(state => state.setAppMode);
  const theme = useMapStore(state => state.theme);
  const setTheme = useMapStore(state => state.setTheme);
  const uiHidden = useMapStore(state => state.uiHidden);
  const toggleUiHidden = useMapStore(state => state.toggleUiHidden);
  const showLabels = useMapStore(state => state.showLabels);
  const toggleLabels = useMapStore(state => state.toggleLabels);
  const showLandmarks = useMapStore(state => state.showLandmarks);
  const toggleLandmarks = useMapStore(state => state.toggleLandmarks);

  const pastStates = useStore(useMapStore.temporal, (state) => state.pastStates);
  const futureStates = useStore(useMapStore.temporal, (state) => state.futureStates);
  const undo = useStore(useMapStore.temporal, (state) => state.undo);
  const redo = useStore(useMapStore.temporal, (state) => state.redo);

  const isDark = theme === 'dark';
  const bg = 'rgba(10, 14, 23, 0.70)';
  const border = isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(245, 158, 11, 0.4)';
  const activeBg = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
  const inactiveColor = isDark ? '#94a3b8' : '#64748b';
  
  return (
    <div
      className="mode-toggle-container"
      style={{
        position: 'absolute', top: 0, right: 30, zIndex: 1200,
        display: 'flex', gap: 12
      }}
    >
      <div style={{
        position: 'relative',
        display: 'flex', background: bg, borderRadius: '0 0 20px 20px', padding: '4px 6px 6px 6px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)', backdropFilter: 'blur(16px)', border, borderTop: 'none'
      }}>
        {/* Smooth Sliding Active Background Pill */}
        <div style={{
          position: 'absolute',
          top: 4,
          bottom: 4,
          left: appMode === 'edit' ? 4 : 'calc(50% + 2px)',
          width: 'calc(50% - 6px)',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: '0 0 14px 14px',
          boxShadow: '0 2px 10px rgba(245, 158, 11, 0.4)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 1,
          pointerEvents: 'none'
        }} />

        <button
          onClick={() => setAppMode('edit')}
          className="btn-hover-effect"
          style={{
            position: 'relative', zIndex: 2, flex: 1,
            border: 'none', background: 'transparent',
            borderRadius: 16, padding: '6px 18px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', color: appMode === 'edit' ? '#000000' : inactiveColor,
            transition: 'color 0.25s ease'
          }}
        >
          Edit
        </button>
        <button
          onClick={() => setAppMode('viewer')}
          className="btn-hover-effect"
          style={{
            position: 'relative', zIndex: 2, flex: 1,
            border: 'none', background: 'transparent',
            borderRadius: 16, padding: '6px 18px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', color: appMode === 'viewer' ? '#000000' : inactiveColor,
            transition: 'color 0.25s ease'
          }}
        >
          Viewer
        </button>
      </div>
    </div>
  );
}
