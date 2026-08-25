import { useState, useEffect, useRef } from 'react';
import { FiX, FiSave, FiMaximize, FiCrosshair, FiMapPin, FiBriefcase, FiUser, FiExternalLink, FiTrash2, FiShare2 } from 'react-icons/fi';
import { useMapStore } from '../store/useMapStore';
import { PROPERTY_TYPES, PROPERTY_TYPE_COLORS, normalizePropertyType, getPropertyTypeColor, determineParentLocation, CATEGORY_MAP } from '../config/categories';

function SearchableSelect({ value, options, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);
  
  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.35)',
          fontSize: 13, color: '#e2e8f0', background: disabled ? 'rgba(30, 41, 59, 0.4)' : 'rgba(30, 41, 59, 0.8)',
          cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}
      >
        <span style={{ opacity: value ? 1 : 0.6 }}>{value || 'Select Parent Location'}</span>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>▼</span>
      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: 4,
          background: '#1e293b', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 8,
          maxHeight: 220, overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, background: '#1e293b' }}>
             <input 
                type="text" 
                autoFocus
                placeholder="Search areas..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '6px 8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
                  color: '#e2e8f0', outline: 'none', boxSizing: 'border-box', fontSize: 13
                }}
              />
          </div>
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12 }}>No matching areas</div>
          ) : (
            filteredOptions.map(opt => (
              <div 
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                style={{
                  padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: '#cbd5e1',
                  background: value === opt ? 'rgba(59,130,246,0.2)' : 'transparent',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = value === opt ? 'rgba(59,130,246,0.2)' : 'transparent'}
              >
                {opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
import toast from 'react-hot-toast';
import { requestLogin, syncFeatureToSheet } from '../services/googleSheets';

const MATCH_TIER_BADGES = {
  'exact-tp-fp': { label: 'Matched by TP/FP', background: '#dcfce7', color: '#15803d' },
  contains: { label: 'Matched: inside polygon boundary', background: '#dbeafe', color: '#1d4ed8' },
  'nearest-border': { label: 'Matched: nearest border — review recommended', background: '#fef3c7', color: '#92400e' }
};

function getMatchBadge(feature) {
  const tier = feature?.data?.matchTier;
  const badge = MATCH_TIER_BADGES[tier];
  if (!badge) return null;

  const distance = feature.data.matchDistanceMeters;
  const label = tier === 'nearest-border' && Number.isFinite(distance)
    ? `Matched: ${distance.toFixed(0)}m from nearest border — review recommended`
    : badge.label;

  return { ...badge, label };
}

const panelStyle = {
  position: 'absolute',
  top: 70,
  right: 20,
  zIndex: 1100,
  width: 340,
  background: 'rgba(15, 23, 42, 0.92)',
  borderRadius: 16,
  boxShadow: '0 20px 48px rgba(0, 0, 0, 0.5)',
  boxSizing: 'border-box',
  backdropFilter: 'blur(12px)',
  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
  display: 'flex',
  flexDirection: 'column',
};

export default function PropertyInfoPanel() {
  const isOpen = useMapStore(state => state.isInfoPanelOpen);
  const setIsOpen = useMapStore(state => state.setIsInfoPanelOpen);
  const appMode = useMapStore(state => state.appMode);
  const selectedFeatureId = useMapStore(state => state.selectedFeatureId);
  const setSelectedFeatureId = useMapStore(state => state.setSelectedFeatureId);
  const features = useMapStore(state => state.features);
  const updateFeature = useMapStore(state => state.updateFeature);
  const removeFeature = useMapStore(state => state.removeFeature);
  const googleSheetsConnected = useMapStore(state => state.googleSheetsConnected);
  const spreadsheetId = useMapStore(state => state.spreadsheetId);
  const customAreas = useMapStore(state => state.customAreas) || [];
  const allParentLocations = Array.from(new Set([...Object.keys(CATEGORY_MAP), ...customAreas])).sort();
  const allSecondaryLocations = Array.from(new Set([...Object.values(CATEGORY_MAP).flat(), ...customAreas])).filter(Boolean).sort();
  const allLandmarks = Array.from(new Set(features.map(f => f.data?.landmark || f.landmark).filter(Boolean))).sort();

  const feature = features.find(f => f.id === selectedFeatureId);
  const [cachedFeature, setCachedFeature] = useState(null);

  useEffect(() => {
    if (feature) {
      setCachedFeature(feature);
    }
  }, [feature]);

  const displayFeature = feature || cachedFeature;

  const areaUnit = useMapStore(state => state.globalAreaUnit);
  const setAreaUnit = useMapStore(state => state.setGlobalAreaUnit);

  const [isSaving, setIsSaving] = useState(false);
  const YARDS_PER_WINGHA = 23.83 * 121; // Assuming 1 Vigha = 2883.43 sq yards (Gujarat). Can be adjusted if needed.

  const [formData, setFormData] = useState({
    name: '',
    tp: '',
    op: '',
    fp: '',
    area: '',
    location: '',
    parentLocation: '',
    landmark: '',
    type: '',
    remarks: ''
  });

  useEffect(() => {
    if (displayFeature && displayFeature.data) {
      const loc = displayFeature.data.location || '';
      const pLoc = displayFeature.data.parentLocation || displayFeature.data.parent_location || determineParentLocation(loc);
      setFormData({
        name: displayFeature.data.name || '',
        tp: displayFeature.data.tp || '',
        op: displayFeature.data.op || '',
        fp: displayFeature.data.fp || '',
        area: displayFeature.data.area || '',
        location: loc,
        parentLocation: pLoc,
        landmark: displayFeature.data.landmark || '',
        type: displayFeature.data.type || '',
        remarks: displayFeature.data.remarks || ''
      });
    }
  }, [displayFeature]);

  if (!displayFeature) return null;

  // Landmarks have their own UI — don't show the polygon Property Info panel for them
  const isLandmarkFeature = displayFeature.id?.startsWith('landmark-') || displayFeature.data?.type === 'Landmark';
  if (isLandmarkFeature) return null;

  const isEdit = appMode === 'edit';
  const matchBadge = getMatchBadge(displayFeature);

  const themeColor = getPropertyTypeColor(formData.type || displayFeature.data?.type);

  const handleCategoryChange = (type) => {
    setFormData(prev => ({ ...prev, type }));
    if (displayFeature) {
      updateFeature(displayFeature.id, {
        data: { ...displayFeature.data, type }
      });
    }
  };

  const handleChange = (field, value) => {
    if (field === 'type') {
      handleCategoryChange(value);
      return;
    }
    if (!isEdit) return;
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'location') {
        next.parentLocation = determineParentLocation(value);
      }
      if (displayFeature) {
        updateFeature(displayFeature.id, {
          data: {
            ...displayFeature.data,
            ...next
          }
        });
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updatedData = {
      tp: formData.tp,
      op: formData.op,
      fp: formData.fp,
      area: formData.area,
      location: formData.location,
      parentLocation: formData.parentLocation || determineParentLocation(formData.location),
      landmark: formData.landmark,
      type: formData.type,
      remarks: formData.remarks
    };

    const typeColor = getPropertyTypeColor(formData.type);
    const updatedStyle = {
      ...displayFeature.style,
      fillColor: typeColor,
      strokeColor: typeColor,
      visible: true
    };

    updateFeature(displayFeature.id, {
      data: updatedData,
      style: updatedStyle,
      syncStatus: 'edited'
    });

    try {
      const updatedFeature = {
        ...displayFeature,
        data: updatedData,
        style: updatedStyle
      };
      // User requested to fire the global 'connect sheet' (syncData) function on save
      window.dispatchEvent(new CustomEvent('trigger-global-sync'));
      toast.success('Saved property changes. Syncing to Google Sheets...');
    } catch (err) {
      console.error(err);
      toast.success('Saved property locally!');
    }

    setIsOpen(false);
    setIsSaving(false);
    
    // Trigger Map -> Sheet sync
    window.dispatchEvent(new Event('trigger-update-sheet'));
  };

  const handleDelete = async () => {
    if (!displayFeature) return;

    removeFeature(displayFeature.id);
    setIsOpen(false);
    setSelectedFeatureId(null);
    toast.success('Polygon deleted. Syncing to Google Sheets...');

    // Trigger Map -> Sheet sync
    window.dispatchEvent(new Event('trigger-update-sheet'));
  };

  if (!isEdit) {
    let tpVal = formData.tp;
    let opVal = formData.op;
    let fpVal = formData.fp;

    if (!tpVal && formData.name) {
      const match = formData.name.match(/TP[:\s]*([A-Z0-9\/]+)/i);
      if (match) tpVal = match[1];
    }
    if (!opVal && formData.name) {
      const match = formData.name.match(/OP[:\s]*([A-Z0-9\/]+)/i);
      if (match) opVal = match[1];
    }
    if (!fpVal && formData.name) {
      const match = formData.name.match(/FP[:\s]*([A-Z0-9\/]+)/i);
      if (match) fpVal = match[1];
    }

    const tpOpFp = `TP: ${tpVal || '_'}   |   OP: ${opVal || '_'}   |   FP: ${fpVal || '_'}`;
    const rawName = (formData.name && formData.name.trim() !== '' && formData.name !== '-' && formData.name !== '_' && formData.name !== 'Polygon' && formData.name !== 'Marker') ? formData.name : '';
    const numArea = parseFloat(formData.area);
    const areaValue = Number.isFinite(numArea)
      ? (areaUnit === 'wingha'
        ? `${(numArea / YARDS_PER_WINGHA).toFixed(2)} Wingha`
        : `${numArea} Sq yard`)
      : (formData.area ? `${formData.area} Sq yard` : 'No Area');

    const getFeatureCoords = (feat) => {
      if (feat?.center?.lat && feat?.center?.lng) return feat.center;
      if (feat?.position?.lat && feat?.position?.lng) return feat.position;
      if (feat?.coordinates && feat.coordinates.length > 0) {
        const latSum = feat.coordinates.reduce((sum, c) => sum + c.lat, 0);
        const lngSum = feat.coordinates.reduce((sum, c) => sum + c.lng, 0);
        return { lat: latSum / feat.coordinates.length, lng: lngSum / feat.coordinates.length };
      }
      return null;
    };

    const coords = getFeatureCoords(displayFeature);

    const handleRedirectToGoogleMaps = (e) => {
      if (e.target.closest('.close-panel-btn') || e.target.closest('.share-polygon-btn')) {
        return;
      }
      if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
        const mapsUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
        window.open(mapsUrl, '_blank', 'noopener,noreferrer');
      } else {
        import('react-hot-toast').then(m => m.default.error('No valid coordinates found for this pin.'));
      }
    };

    const handleSharePolygon = (e) => {
      if (e) e.stopPropagation();
      if (!displayFeature) return;

      const d = displayFeature.data || {};
      const areaUnitState = useMapStore.getState().globalAreaUnit;

      let areaStr = '';
      if (d.area) {
        areaStr = areaUnitState === 'wingha'
          ? `${(Number(d.area) / (23.83 * 121)).toFixed(2)} Wingha`
          : `${d.area} sq. yard`;
      }

      const title = d.name || d.location || `Plot ${displayFeature.id}`;
      const tpFpStr = [
        d.tpNo || d.tp ? `TP: ${d.tpNo || d.tp}` : '',
        d.opNo || d.op ? `OP: ${d.opNo || d.op}` : '',
        d.fpNo || d.fp ? `FP: ${d.fpNo || d.fp}` : ''
      ].filter(Boolean).join(' | ');

      const locationStr = d.location ? `${d.location}${d.parentLocation ? `, ${d.parentLocation}` : ''}` : 'Surat';
      const categoryStr = d.type ? d.type.toUpperCase() : 'LAND';

      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.set('feature', displayFeature.id);

      const shareText = `📍 *Karma Realtors - Selected Plot Details*\n\n` +
        `🏢 *Title*: ${title}\n` +
        `📍 *Location*: ${locationStr}\n` +
        (tpFpStr ? `📐 *TP/OP/FP*: ${tpFpStr}\n` : '') +
        (areaStr ? `📏 *Area*: ${areaStr}\n` : '') +
        `🏷️ *Category*: ${categoryStr}\n\n` +
        `🔗 *View on Interactive Map*:\n${shareUrl.toString()}`;

      if (navigator.share) {
        navigator.share({
          title: `Karma Realtors - ${title}`,
          text: shareText,
          url: shareUrl.toString()
        }).then(() => {
          import('react-hot-toast').then(m => m.default.success('Polygon info shared! 🚀', {
            style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
          }));
        }).catch(err => {
          if (err.name !== 'AbortError' && navigator.clipboard) {
            navigator.clipboard.writeText(shareText);
            import('react-hot-toast').then(m => m.default.success('Polygon info & link copied to clipboard! 📋', {
              style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
            }));
          }
        });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText);
        import('react-hot-toast').then(m => m.default.success('Polygon info & link copied to clipboard! 📋', {
          style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
        }));
      }
    };



    return (
      <div
        key={displayFeature.id}
        className={`responsive-info-panel ${isOpen ? 'is-open' : ''}`}
        onClick={handleRedirectToGoogleMaps}
        title="Click anywhere to open location in Google Maps ↗"
        style={{
          ...panelStyle,
          background: 'rgba(15, 23, 42, 0.92)',
          border: `2px solid ${themeColor}`,
          borderRadius: 16,
          padding: '20px 16px 16px 16px',
          color: '#e2e8f0',
          
          
          
          boxShadow: `0 20px 48px rgba(0, 0, 0, 0.5), 0 0 16px ${themeColor}40`,
          cursor: 'pointer',
          
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FiMaximize size={22} color={themeColor} />
            <span style={{ fontSize: 18, fontWeight: 600, color: '#f8fafc', letterSpacing: '0.3px' }}>{areaValue}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="share-polygon-btn"
              onClick={handleSharePolygon}
              title="Share active polygon details & map link"
              style={{
                background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)',
                cursor: 'pointer', borderRadius: '50%',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.2s', color: '#f59e0b'
              }}
            >
              <FiShare2 size={16} color="#f59e0b" strokeWidth={2.5} />
            </button>
            <button
              className="close-panel-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                setSelectedFeatureId(null);
              }}
              style={{
                background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', borderRadius: '50%',
                width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.2s'
              }}
            >
              <FiX size={16} color="#cbd5e1" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.1)', margin: '16px 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <FiCrosshair size={18} color={themeColor} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, color: '#cbd5e1', letterSpacing: '0.3px', fontWeight: 600 }}>{tpOpFp}</span>
              {rawName && (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{rawName}</span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <FiMapPin size={18} color={themeColor} style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.4 }}>
              {formData.location || formData.landmark || 'No location set'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FiBriefcase size={18} color={themeColor} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 15, color: '#cbd5e1' }}>Category :</span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 16,
              border: `1.5px solid ${themeColor}`,
              background: `${themeColor}25`,
              color: '#f8fafc',
              fontSize: 13,
              fontWeight: 600
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: themeColor, display: 'inline-block' }} />
              {formData.type || displayFeature.data?.type || 'Uncategorized'}
            </span>
          </div>


          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${themeColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: themeColor, fontSize: 10, fontWeight: 'bold', flexShrink: 0, marginTop: 2
            }}>
              R
            </div>
            <span style={{ fontSize: 15, color: '#cbd5e1' }}>Remark : {formData.remarks || '-'}</span>
          </div>
        </div>

        <div style={{
          marginTop: 16,
          padding: '8px 12px',
          borderRadius: 10,
          background: 'rgba(59, 130, 246, 0.15)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 12,
          fontWeight: 600,
          color: '#60a5fa'
        }}>
          <FiExternalLink size={14} /> Open in Google Maps ↗
        </div>
      </div>
    );
  }

  return (
    <div
      key={displayFeature.id}
      style={{
        ...panelStyle,
        border: `2px solid ${themeColor}`,
        boxShadow: `0 20px 48px rgba(0, 0, 0, 0.5), 0 0 16px ${themeColor}40`,
        
        
        
        
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>Property Info</h3>
        </div>
        <button
          onClick={() => {
            setIsOpen(false);
            setSelectedFeatureId(null);
          }}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#94a3b8', padding: 4, display: 'flex', alignItems: 'center'
          }}
        >
          <FiX size={20} />
        </button>
      </div>

      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gap: '12px' }}>

          {matchBadge && (
            <div style={{
              padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: matchBadge.background, color: matchBadge.color
            }}>
              {matchBadge.label}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>T.P.</label>
              <input
                type="text"
                value={formData.tp}
                onChange={(e) => handleChange('tp', e.target.value)}
                disabled={!isEdit}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.35)',
                  fontSize: 13, color: '#e2e8f0', background: isEdit ? 'rgba(30, 41, 59, 0.8)' : 'rgba(30, 41, 59, 0.4)',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>O.P.</label>
              <input
                type="text"
                value={formData.op}
                onChange={(e) => handleChange('op', e.target.value)}
                disabled={!isEdit}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.35)',
                  fontSize: 13, color: '#e2e8f0', background: isEdit ? 'rgba(30, 41, 59, 0.8)' : 'rgba(30, 41, 59, 0.4)',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>F.P.</label>
              <input
                type="text"
                value={formData.fp}
                onChange={(e) => handleChange('fp', e.target.value)}
                disabled={!isEdit}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.35)',
                  fontSize: 13, color: '#e2e8f0', background: isEdit ? 'rgba(30, 41, 59, 0.8)' : 'rgba(30, 41, 59, 0.4)',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Area</label>
              <div style={{ display: 'flex', gap: 4, background: 'rgba(30, 41, 59, 0.6)', padding: 2, borderRadius: 6 }}>
                <button
                  type="button"
                  onClick={() => setAreaUnit('yards')}
                  style={{
                    border: 'none', background: areaUnit === 'yards' ? '#3b82f6' : 'transparent',
                    boxShadow: areaUnit === 'yards' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    color: areaUnit === 'yards' ? '#fff' : '#94a3b8'
                  }}
                >Yards</button>
                <button
                  type="button"
                  onClick={() => setAreaUnit('wingha')}
                  style={{
                    border: 'none', background: areaUnit === 'wingha' ? '#3b82f6' : 'transparent',
                    boxShadow: areaUnit === 'wingha' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    color: areaUnit === 'wingha' ? '#fff' : '#94a3b8'
                  }}
                >Wingha</button>
              </div>
            </div>
            <input
              type="number"
              step="any"
              value={areaUnit === 'wingha' && formData.area ? (Number(formData.area) / YARDS_PER_WINGHA).toFixed(4).replace(/\.?0+$/, '') : formData.area}
              onChange={(e) => {
                const val = e.target.value;
                if (areaUnit === 'wingha') {
                  handleChange('area', val ? String(Number(val) * YARDS_PER_WINGHA) : '');
                } else {
                  handleChange('area', val);
                }
              }}
              disabled={!isEdit}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.35)',
                fontSize: 13, color: '#e2e8f0', background: isEdit ? 'rgba(30, 41, 59, 0.8)' : 'rgba(30, 41, 59, 0.4)',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Parent Location</label>
            <SearchableSelect
              value={formData.parentLocation || determineParentLocation(formData.location)}
              options={allParentLocations}
              onChange={(val) => handleChange('parentLocation', val)}
              disabled={!isEdit}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Location</label>
            <SearchableSelect
              value={formData.location}
              options={allSecondaryLocations}
              onChange={(val) => handleChange('location', val)}
              disabled={!isEdit}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Landmark nearby</label>
            <input
              type="text"
              value={formData.landmark || ''}
              onChange={(e) => handleChange('landmark', e.target.value)}
              disabled={!isEdit}
              placeholder={isEdit ? "Enter nearby landmark" : "-"}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.35)',
                fontSize: 13, color: '#e2e8f0', background: isEdit ? 'rgba(30, 41, 59, 0.8)' : 'rgba(30, 41, 59, 0.4)',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Category Type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {PROPERTY_TYPES.map(type => {
                const color = PROPERTY_TYPE_COLORS[type];
                const isSelected = normalizePropertyType(formData.type) === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleChange('type', type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 20,
                      border: isSelected ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.15)',
                      background: isSelected ? `${color}35` : 'rgba(30, 41, 59, 0.6)',
                      color: isSelected ? '#ffffff' : '#cbd5e1',
                      fontSize: 12,
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? `0 2px 8px ${color}40` : 'none'
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Remarks</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              disabled={!isEdit}
              rows={3}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.35)',
                fontSize: 13, color: '#e2e8f0', background: isEdit ? 'rgba(30, 41, 59, 0.8)' : 'rgba(30, 41, 59, 0.4)',
                outline: 'none', boxSizing: 'border-box', resize: 'vertical'
              }}
            />
          </div>
        </div>
      </div>

      {isEdit && (
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(15, 23, 42, 0.6)', display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={handleDelete}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 0', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <FiTrash2 size={16} /> Delete
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 0', background: '#3b82f6', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
              opacity: isSaving ? 0.7 : 1
            }}
          >
            <FiSave size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
