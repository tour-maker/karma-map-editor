import { useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { determineParentLocation, CATEGORY_MAP } from '../config/categories';
import { syncFeatureToSheet, syncLandmarkToSheet } from '../services/googleSheets';
import { FiMapPin, FiX, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';

import { cleanLandmarkTitle } from './LandmarkManager';

export default function AddLandmarkModal({ position, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('Surat');
  const [remarks, setRemarks] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const addFeatures = useMapStore(state => state.addFeatures);

  const locationsList = Object.keys(CATEGORY_MAP);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a landmark name');
      return;
    }

    setIsSaving(true);
    const cleanedName = cleanLandmarkTitle(name);
    const parentLoc = determineParentLocation(location);

    const newLandmarkFeature = {
      id: `landmark-${Date.now()}`,
      type: 'marker',
      position: {
        lat: Number(position.lat),
        lng: Number(position.lng)
      },
      data: {
        name: cleanedName,
        landmark: cleanedName,
        location: location.trim(),
        parentLocation: parentLoc,
        type: 'Landmark',
        remarks: remarks.trim()
      },
      style: {
        color: '#64748b',
        visible: true
      }
    };

    addFeatures([newLandmarkFeature]);

    const spreadsheetId = useMapStore.getState().spreadsheetId;

    try {
      await syncLandmarkToSheet(newLandmarkFeature, spreadsheetId || 'default');
    } catch (err) {
      console.error('Failed to sync landmark to Google Sheets:', err);
    }

    toast.success(`Landmark "${name.trim()}" added successfully!`);
    setIsSaving(false);
    if (onSaved) onSaved(newLandmarkFeature);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#0f172a',
        border: '1px solid rgba(251, 191, 36, 0.4)',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        color: '#f8fafc',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FiMapPin size={18} color="#fbbf24" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>Add New Landmark</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Place a reference pin on map</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#94a3b8',
              cursor: 'pointer', padding: 4, borderRadius: 6
            }}
          >
            <FiX size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Landmark Name */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Landmark Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. VK Farm Plot, Tirupati Circle"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid rgba(99, 102, 241, 0.35)', background: 'rgba(30, 41, 59, 0.8)',
                color: '#f8fafc', fontSize: 13, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Location */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Location / Area
            </label>
            <input
              type="text"
              placeholder="e.g. Dumas, Adajan, Surat"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid rgba(99, 102, 241, 0.35)', background: 'rgba(30, 41, 59, 0.8)',
                color: '#f8fafc', fontSize: 13, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Coordinates (ReadOnly info) */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#94a3b8', display: 'flex', gap: 16
          }}>
            <div>Lat: <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{Number(position.lat).toFixed(5)}</span></div>
            <div>Lng: <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{Number(position.lng).toFixed(5)}</span></div>
          </div>

          {/* Remarks */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Remarks (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Optional notes or landmark details..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid rgba(99, 102, 241, 0.35)', background: 'rgba(30, 41, 59, 0.8)',
                color: '#f8fafc', fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical'
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '10px 0', background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: 8,
                color: '#cbd5e1', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                flex: 2, padding: '10px 0', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6, boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
              }}
            >
              <FiCheck size={16} /> {isSaving ? 'Saving...' : 'Save Landmark'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
