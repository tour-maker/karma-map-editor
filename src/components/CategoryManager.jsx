import { useState, useEffect } from 'react';
import { FiX, FiPlus, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useMapStore } from '../store/useMapStore';
import { API_BASE_URL } from '../config/api';
import { normalizePropertyType } from '../config/categories';
import { renameTypeInSheet, withSyncRetry } from '../services/googleSheets';
import { glassPanelStyle, GLASS_RADIUS, GOLD_GRADIENT, GOLD_GRADIENT_SHADOW, GLASS_FONT } from '../styles/glass';

const PRESET_COLORS = ['#38bdf8', '#f97316', '#facc15', '#a855f7', '#22c55e', '#ec4899', '#ef4444', '#06b6d4', '#10b981', '#6366f1', '#f43f5e', '#84cc16'];

const adminHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${sessionStorage.getItem('karmaAdminJWT')}`
});

// The same pin shape the map uses, in the category's colour.
function Pin({ color }) {
  return (
    <svg width="18" height="26" viewBox="0 0 20 28" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M10 0C4.5 0 0 4.4 0 9.8 0 17 10 28 10 28s10-11 10-18.2C20 4.4 15.5 0 10 0z" fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      <circle cx="10" cy="9.8" r="3.6" fill="rgba(255,255,255,0.9)" />
    </svg>
  );
}

// One "Select colour" button; the pin beside the name already previews the chosen colour.
function ColorPicker({ value, onChange }) {
  return (
    <label style={{
      position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
      padding: '6px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#e2e8f0',
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)'
    }}>
      <span style={{ width: 14, height: 14, borderRadius: '50%', background: value, border: '1px solid rgba(255,255,255,0.4)' }} />
      Select colour
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select colour"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
      />
    </label>
  );
}

const inputStyle = {
  flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10, boxSizing: 'border-box',
  background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.18)',
  color: '#f8fafc', fontSize: 13, outline: 'none'
};

// Admin: add categories, rename them, and choose the colour of their polygons and map pins.
export default function CategoryManager({ onClose }) {
  const spreadsheetId = useMapStore(state => state.spreadsheetId);
  const applyCategories = useMapStore(state => state.applyCategories);
  const retypeFeatures = useMapStore(state => state.retypeFeatures);

  const [categories, setCategories] = useState([]);
  const [drafts, setDrafts] = useState({}); // id -> { name, color }
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[7]);

  const load = async () => {
    const res = await fetch(`${API_BASE_URL}/api/categories`);
    if (!res.ok) throw new Error('Could not load the categories');
    const list = await res.json();
    setCategories(list);
    setDrafts(Object.fromEntries(list.map(c => [c._id, { name: c.name, color: c.color }])));
    applyCategories(list);
    return list;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) toast.error(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCategory = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) { toast.error('Please enter a category name'); return; }
    setBusyId('new');
    try {
      const res = await fetch(`${API_BASE_URL}/api/categories`, {
        method: 'POST', headers: adminHeaders(), body: JSON.stringify({ name, color: newColor })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not add the category');
      await load();
      setNewName('');
      toast.success(`Category "${body.name}" added`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const saveCategory = async (category) => {
    const draft = drafts[category._id];
    const name = draft.name.trim();
    if (!name) { toast.error('The name cannot be empty'); return; }
    const renamed = name !== category.name;
    setBusyId(category._id);
    const toastId = toast.loading(renamed ? 'Renaming...' : 'Saving...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/categories/${category._id}`, {
        method: 'PUT', headers: adminHeaders(),
        body: JSON.stringify({ ...(renamed ? { name } : {}), color: draft.color })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save the category');
      await load(); // the list now knows the new name, so the old name resolves to it

      if (renamed) {
        const newType = body.category.name;
        const matches = (value) => value !== newType && normalizePropertyType(value) === newType;
        const changed = retypeFeatures(matches, newType);
        if (spreadsheetId && changed > 0) {
          toast.loading(`Updating ${changed} plot${changed === 1 ? '' : 's'} in Google Sheets...`, { id: toastId });
          try {
            await withSyncRetry(() => renameTypeInSheet(spreadsheetId, matches, newType));
            useMapStore.setState(state => ({
              features: state.features.map(f => (f.syncStatus === 'edited' && f.data?.type === newType ? { ...f, syncStatus: 'synced' } : f))
            }));
          } catch (sheetErr) {
            console.error('Category rename: sheet update failed:', sheetErr);
            toast.error('The category was renamed, but the plots in Google Sheets were NOT updated: ' + (sheetErr?.message || 'unknown error') + '. Save the category again to retry.', { id: toastId, duration: 8000 });
            return;
          }
        }
        toast.success(`Renamed to "${newType}"${changed ? ` - ${changed} plot${changed === 1 ? '' : 's'} updated` : ''}`, { id: toastId });
      } else {
        toast.success('Colour saved', { id: toastId });
      }
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{ ...glassPanelStyle, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 20, color: '#f8fafc', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#FDB713', ...GLASS_FONT.serif }}>Categories</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Name and pin colour for each property category</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><FiX size={20} /></button>
        </div>

        {loading ? (
          <div style={{ color: '#94a3b8', padding: 16 }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {categories.map(category => {
              const draft = drafts[category._id] || { name: category.name, color: category.color };
              const dirty = draft.name.trim() !== category.name || draft.color.toLowerCase() !== category.color.toLowerCase();
              return (
                <div key={category._id} style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Pin color={draft.color} />
                    <input
                      value={draft.name}
                      maxLength={40}
                      onChange={(e) => setDrafts(prev => ({ ...prev, [category._id]: { ...draft, name: e.target.value } }))}
                      aria-label={`Name of ${category.name}`}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      disabled={!dirty || busyId === category._id}
                      onClick={() => saveCategory(category)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, border: 'none',
                        background: dirty ? GOLD_GRADIENT : 'rgba(255,255,255,0.06)', color: dirty ? '#1c1406' : '#64748b',
                        fontSize: 12, fontWeight: 700, cursor: dirty ? 'pointer' : 'default', opacity: busyId === category._id ? 0.6 : 1
                      }}
                    >
                      <FiCheck size={13} /> Save
                    </button>
                  </div>
                  <ColorPicker value={draft.color} onChange={(color) => setDrafts(prev => ({ ...prev, [category._id]: { ...draft, color } }))} />
                </div>
              );
            })}

            <form onSubmit={addCategory} style={{ padding: 10, borderRadius: 12, border: '1px dashed rgba(245, 158, 11, 0.45)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>Add a category</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pin color={newColor} />
                <input value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Plotted Scheme" style={inputStyle} />
                <button type="submit" disabled={busyId === 'new'} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: GLASS_RADIUS.control, border: 'none',
                  background: GOLD_GRADIENT, boxShadow: GOLD_GRADIENT_SHADOW, color: '#1c1406', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                }}>
                  <FiPlus size={13} /> Add
                </button>
              </div>
              <ColorPicker value={newColor} onChange={setNewColor} />
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
