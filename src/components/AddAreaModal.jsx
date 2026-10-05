import { useState, useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import { CATEGORY_MAP } from '../config/categories';
import { FiGlobe, FiX, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { updateAreasSheet } from '../services/googleSheets';

export default function AddAreaModal({ onClose, onSaved, existingPrimaryNames = [] }) {
  // 'primary' = brand-new Primary Location (optionally with its own Sub-locations
  // typed in at the same time); 'sub' = a new Sub-location inside an EXISTING
  // Primary. Both funnel through the same submit path below — a Sub-location add
  // is just a Primary-location add whose name already exists, which the existing
  // CATEGORY_MAP-merge logic already handles.
  const [mode, setMode] = useState('primary');
  const [areaName, setAreaName] = useState('');
  const [subLocations, setSubLocations] = useState('');
  const [subParent, setSubParent] = useState(existingPrimaryNames[0] || '');
  const [subName, setSubName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const visibleParents = useMemo(() => {
    const q = parentSearch.trim().toLowerCase();
    return existingPrimaryNames.filter(n => n.toLowerCase().includes(q));
  }, [existingPrimaryNames, parentSearch]);

  const addCustomArea = useMapStore(state => state.addCustomArea);
  const setFilterPrimary = useMapStore(state => state.setFilterPrimary);
  const spreadsheetId = useMapStore(state => state.spreadsheetId);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = mode === 'sub' ? subParent.trim() : areaName.trim();
    if (!name) {
      toast.error(mode === 'sub' ? 'Please choose a Primary Location' : 'Please enter a Parent Location name');
      return;
    }
    if (mode === 'sub' && !subName.trim()) {
      toast.error('Please enter a Sub-location name');
      return;
    }

    setIsSaving(true);

    const subs = mode === 'sub'
      ? [subName.trim()]
      : (subLocations.trim() ? subLocations.split(',').map(s => s.trim()).filter(Boolean) : []);

    // Sync only this new area to the "Areas" tab — never touch the Polygons sheet here.
    try {
      const additions = subs.length > 0
        ? subs.map(secondary => ({ parent: name, secondary }))
        : [{ parent: name, secondary: '' }];
      await updateAreasSheet(spreadsheetId, { add: additions });

      addCustomArea(name);
      const existingKey = Object.keys(CATEGORY_MAP).find(key => key.toLowerCase() === name.toLowerCase());
      const categoryKey = existingKey || name;
      CATEGORY_MAP[categoryKey] = Array.from(new Map(
        [...(CATEGORY_MAP[categoryKey] || []), ...subs].map(value => [value.toLowerCase(), value])
      ).values());
      useMapStore.setState(state => {
        const pairs = [...(state.syncedAreas || [])];
        additions.forEach(({ parent, secondary }) => {
          if (!pairs.some(pair => pair.parent?.toLowerCase() === parent.toLowerCase() &&
            (pair.secondary || '').toLowerCase() === secondary.toLowerCase())) {
            pairs.push({ parent, secondary });
          }
        });
        return { syncedAreas: pairs };
      });
      setFilterPrimary(name);
      const successMsg = mode === 'sub'
        ? `Sub-location "${subs[0]}" added to "${name}"! 📍`
        : `Parent Location "${name}" added successfully! 📍`;
      toast.success(successMsg, {
        style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
      });
    } catch (err) {
      console.error('Failed to sync new area to Google Sheets:', err);
      toast.error('Area was not saved. Google Sheets sync failed: ' + (err?.message || 'unknown error'));
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    if (onSaved) onSaved(name);
    if (onClose) onClose();
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
          {/* Mode toggle: a brand-new Primary Location, or a new Sub-location inside
              one that already exists. */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setMode('primary')}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, textAlign: 'center', cursor: 'pointer',
                fontSize: 11.5, fontWeight: 700,
                background: mode === 'primary' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                border: mode === 'primary' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.14)',
                color: mode === 'primary' ? '#f59e0b' : '#94a3b8'
              }}
            >
              New Primary Location
            </button>
            <button
              type="button"
              onClick={() => setMode('sub')}
              disabled={existingPrimaryNames.length === 0}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, textAlign: 'center',
                cursor: existingPrimaryNames.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 11.5, fontWeight: 700,
                background: mode === 'sub' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                border: mode === 'sub' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.14)',
                color: mode === 'sub' ? '#f59e0b' : '#94a3b8',
                opacity: existingPrimaryNames.length === 0 ? 0.5 : 1
              }}
            >
              New Sub-area
            </button>
          </div>

          {mode === 'primary' ? (
            <>
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
            </>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>
                  Inside which Primary Location? *
                </label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => { setParentOpen(o => !o); setParentSearch(''); }}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                      background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.18)',
                      color: '#f8fafc', fontSize: 13, boxSizing: 'border-box',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <span>{subParent || 'Select location'}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{parentOpen ? '\u25B2' : '\u25BC'}</span>
                  </button>
                  {parentOpen && (
                    <div style={{
                      marginTop: 6, padding: 8, borderRadius: 10, boxSizing: 'border-box',
                      background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(245, 158, 11, 0.35)'
                    }}>
                      <input
                        type="text"
                        placeholder="Search locations..."
                        value={parentSearch}
                        onChange={(e) => setParentSearch(e.target.value)}
                        style={{
                          width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, marginBottom: 6,
                          background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.18)',
                          color: '#f8fafc', fontSize: 12.5, outline: 'none'
                        }}
                      />
                      <div role="listbox" style={{
                        maxHeight: 'min(180px, 28vh)', overflowY: 'auto', overscrollBehavior: 'contain',
                        display: 'flex', flexDirection: 'column', gap: 2, scrollbarWidth: 'thin'
                      }}>
                        {visibleParents.map(n => (
                          <div
                            key={n}
                            role="option"
                            aria-selected={n === subParent}
                            onClick={() => { setSubParent(n); setParentOpen(false); setParentSearch(''); }}
                            style={{
                              padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                              color: n === subParent ? '#f59e0b' : '#e2e8f0',
                              background: n === subParent ? 'rgba(245, 158, 11, 0.18)' : 'transparent'
                            }}
                          >{n}</div>
                        ))}
                        {visibleParents.length === 0 && (
                          <div style={{ padding: '8px 10px', fontSize: 12, color: '#94a3b8' }}>No locations match</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>
                  Sub-location Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Station Road"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.18)',
                    color: '#f8fafc', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    boxShadow: 'inset 0 1.5px 3px rgba(0, 0, 0, 0.4)'
                  }}
                />
              </div>
            </>
          )}

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
