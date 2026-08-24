import { useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { CATEGORY_MAP } from '../config/categories';
import { FiGlobe, FiX, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AddAreaModal({ onClose, onSaved }) {
  const [areaName, setAreaName] = useState('');
  const [subLocations, setSubLocations] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const addCustomArea = useMapStore(state => state.addCustomArea);
  const setFilterPrimary = useMapStore(state => state.setFilterPrimary);

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = areaName.trim();
    if (!name) {
      toast.error('Please enter a Parent Location name');
      return;
    }

    setIsSaving(true);

    // Save to store
    addCustomArea(name);

    // Add sub-locations to CATEGORY_MAP in runtime memory if provided
    if (subLocations.trim()) {
      const subs = subLocations.split(',').map(s => s.trim()).filter(Boolean);
      if (!CATEGORY_MAP[name]) {
        CATEGORY_MAP[name] = subs;
      } else {
        CATEGORY_MAP[name] = Array.from(new Set([...(CATEGORY_MAP[name] || []), ...subs]));
      }
    } else if (!CATEGORY_MAP[name]) {
      CATEGORY_MAP[name] = [];
    }

    // Set filter to this new area
    setFilterPrimary(name);

    toast.success(`Parent Location "${name}" added successfully! 📍`, {
      style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
    });

    setIsSaving(false);
    if (onSaved) onSaved(name);
    if (onClose) onClose();

    // Trigger Map -> Sheet sync
    window.dispatchEvent(new Event('trigger-update-sheet'));
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(11, 17, 30, 0.96) 100%)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: 18, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        color: '#f8fafc', position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b'
            }}>
              <FiGlobe size={18} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>Add Parent Location</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Create a new Area category for plots & map filters</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
              padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>
              Parent Location Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Vapi, Bardoli, Ankleshwar"
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.18)',
                color: '#f8fafc', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                boxShadow: 'inset 0 1.5px 3px rgba(0, 0, 0, 0.4)'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>
              Sub-locations (Optional)
            </label>
            <input
              type="text"
              placeholder="Comma separated (e.g. Station Road, Ten, Dhamdod)"
              value={subLocations}
              onChange={(e) => setSubLocations(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.18)',
                color: '#f8fafc', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                boxShadow: 'inset 0 1.5px 3px rgba(0, 0, 0, 0.4)'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10,
                background: '#f59e0b', border: 'none',
                color: '#000000', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
              }}
            >
              <FiCheck size={16} /> Save Area
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
