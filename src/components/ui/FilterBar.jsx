import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { CATEGORY_MAP, PROPERTY_TYPES, PROPERTY_TYPE_COLORS } from '../../config/categories';
import { useGoogleMap } from '../../context/GoogleMapContext';
import { fitAllBounds } from '../../services/googleMaps';
import { FiChevronDown, FiChevronUp, FiRefreshCw, FiEye, FiEyeOff, FiArrowRight, FiMapPin, FiNavigation, FiTag, FiSquare, FiGrid, FiSliders, FiX } from 'react-icons/fi';
import { isFeatureMatchingUnit } from '../../utils/unitFilter';

const PushPinIcon = ({ color }) => (
  <svg width="18" height="24" viewBox="0 0 16 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6" fill={color} />
    <circle cx="8" cy="8" r="2" fill="white" />
    <path d="M8 14L8 23" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ---------------------------------------------------------------------------
// 1. Primary Location Dropdown Component
// ---------------------------------------------------------------------------
function PrimaryLocationDropdown({ primaryCategories, value, onChange, placeholder = 'Location', activeColor = '#f59e0b', isInModal = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = primaryCategories.filter(cat =>
    cat.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleSelect = (cat) => {
    onChange(cat);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: isInModal ? '100%' : 'auto' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          color: '#f59e0b',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isInModal ? 'space-between' : 'flex-start',
          width: isInModal ? '100%' : 'auto',
          boxSizing: 'border-box',
          gap: 4,
          userSelect: 'none'
        }}
      >
        <span className="desktop-only-text">{value || placeholder}</span>
        <span className="mobile-only-text" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {value ? (value.length > 18 ? value.substring(0, 18) + '..' : value) : (isInModal ? placeholder : <FiMapPin size={16} color="#f59e0b" />)}
        </span>
        {isOpen ? <FiChevronUp size={12} color="#64748b" /> : <FiChevronDown size={12} color="#64748b" />}
      </div>

      {isOpen && (
        <div style={isInModal ? {
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          width: '100%',
          marginTop: 6,
          background: 'rgba(15, 23, 42, 0.98)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 14,
          padding: 8,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8)',
          zIndex: 3000,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column'
        } : {
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 16,
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 14,
          padding: 8,
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6)',
          minWidth: 190,
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <input
            type="text"
            placeholder="Search location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 8,
              padding: '6px 10px',
              color: '#e2e8f0',
              fontSize: 13,
              outline: 'none',
              marginBottom: 8,
              width: '100%',
              boxSizing: 'border-box'
            }}
          />

          <div style={{
            maxHeight: 240,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(245, 158, 11, 0.5) transparent'
          }}>
            <div
              onClick={() => handleSelect(null)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: !value ? activeColor : '#94a3b8',
                background: !value ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <FiRefreshCw size={14} /> All Locations
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: '8px 12px', color: '#64748b', fontSize: 12, textAlign: 'center' }}>
                No results
              </div>
            )}

            {filtered.map(cat => {
              const isActive = value === cat;
              return (
                <div
                  key={cat}
                  onClick={() => handleSelect(cat)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: isActive ? activeColor : '#e2e8f0',
                    background: isActive ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                    transition: 'background 0.15s ease'
                  }}
                >
                  {cat}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Sub-Location Dropdown Component
// ---------------------------------------------------------------------------
function SubLocationDropdown({ subLocations, primaryName, value, onChange, placeholder = 'Location', activeColor = '#f59e0b', isInModal = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = subLocations.filter(sub =>
    sub.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleSelect = (sub) => {
    onChange(sub);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: isInModal ? '100%' : 'auto' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          color: '#f59e0b',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isInModal ? 'space-between' : 'flex-start',
          width: isInModal ? '100%' : 'auto',
          boxSizing: 'border-box',
          gap: 4,
          userSelect: 'none'
        }}
      >
        <span className="desktop-only-text">{value || placeholder}</span>
        <span className="mobile-only-text" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {value ? (value.length > 18 ? value.substring(0, 18) + '..' : value) : (isInModal ? placeholder : <FiNavigation size={15} color="#f59e0b" />)}
        </span>
        {isOpen ? <FiChevronUp size={12} color="#64748b" /> : <FiChevronDown size={12} color="#64748b" />}
      </div>

      {isOpen && (
        <div style={isInModal ? {
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          width: '100%',
          marginTop: 6,
          background: 'rgba(15, 23, 42, 0.98)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 14,
          padding: 8,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8)',
          zIndex: 3000,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column'
        } : {
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 16,
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 14,
          padding: 8,
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6)',
          minWidth: 180,
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <input
            type="text"
            placeholder={`Search in ${primaryName}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 8,
              padding: '6px 10px',
              color: '#e2e8f0',
              fontSize: 13,
              outline: 'none',
              marginBottom: 8,
              width: '100%',
              boxSizing: 'border-box'
            }}
          />

          <div style={{
            maxHeight: 240,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(245, 158, 11, 0.5) transparent'
          }}>
            <div
              onClick={() => handleSelect(null)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: !value ? activeColor : '#94a3b8',
                background: !value ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <FiRefreshCw size={14} /> All {primaryName}
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: '8px 12px', color: '#64748b', fontSize: 12, textAlign: 'center' }}>
                No results
              </div>
            )}

            {filtered.map(sub => {
              const isActive = value === sub;
              return (
                <div
                  key={sub}
                  onClick={() => handleSelect(sub)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: isActive ? activeColor : '#e2e8f0',
                    background: isActive ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                    transition: 'background 0.15s ease'
                  }}
                >
                  {sub}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Category Dropdown Component
// ---------------------------------------------------------------------------
function CategoryDropdown({ options, value, onChange, placeholder = 'Category', activeColor = '#f59e0b', isInModal = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getTypeColor = (type) => PROPERTY_TYPE_COLORS[type] || '#e2e8f0';

  const handleSelect = (type) => {
    onChange(type);
    setIsOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: isInModal ? '100%' : 'auto' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          color: '#f59e0b',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isInModal ? 'space-between' : 'flex-start',
          width: isInModal ? '100%' : 'auto',
          boxSizing: 'border-box',
          gap: 4,
          userSelect: 'none'
        }}
      >
        <span className="desktop-only-text">{value || placeholder}</span>
        <span className="mobile-only-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {value ? (
            <>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: getTypeColor(value) }} />
              <span>{value.length > 18 ? value.substring(0, 18) + '..' : value}</span>
            </>
          ) : (
            isInModal ? placeholder : <FiTag size={15} color="#f59e0b" />
          )}
        </span>
        {isOpen ? <FiChevronUp size={12} color="#64748b" /> : <FiChevronDown size={12} color="#64748b" />}
      </div>

      {isOpen && (
        <div style={isInModal ? {
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          width: '100%',
          marginTop: 6,
          background: 'rgba(15, 23, 42, 0.98)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 14,
          padding: 8,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8)',
          zIndex: 3000,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        } : {
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 16,
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 14,
          padding: 8,
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6)',
          minWidth: 200,
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}>
          <div
            onClick={() => handleSelect(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: !value ? activeColor : '#94a3b8',
              padding: '8px 12px',
              borderRadius: 8,
              background: !value ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
            }}
          >
            <FiRefreshCw size={14} /> Show All
          </div>

          {options.map(type => {
            const isActive = value === type;
            return (
              <div
                key={type}
                onClick={() => handleSelect(type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: isActive ? activeColor : '#e2e8f0',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: isActive ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                  transition: 'background 0.15s ease'
                }}
              >
                <PushPinIcon color={getTypeColor(type)} />
                {type}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FilterBar Component (Clean Capsule Dock Layout - No Notch)
// ---------------------------------------------------------------------------
export default function FilterBar() {
  const filterPrimary = useMapStore(state => state.filterPrimary);
  const filterSecondary = useMapStore(state => state.filterSecondary);
  const filterType = useMapStore(state => state.filterType);
  const globalAreaUnit = useMapStore(state => state.globalAreaUnit);
  const showLandmarks = useMapStore(state => state.showLandmarks);

  const setFilterPrimary = useMapStore(state => state.setFilterPrimary);
  const setFilterSecondary = useMapStore(state => state.setFilterSecondary);
  const setFilterType = useMapStore(state => state.setFilterType);
  const setGlobalAreaUnit = useMapStore(state => state.setGlobalAreaUnit);
  const toggleLandmarks = useMapStore(state => state.toggleLandmarks);
  const setSelectedFeatureId = useMapStore(state => state.setSelectedFeatureId);
  const setIsInfoPanelOpen = useMapStore(state => state.setIsInfoPanelOpen);
  const kmlLayers = useMapStore(state => state.kmlLayers);
  const map = useGoogleMap();

  const features = useMapStore(state => state.features);

  const [animateKey, setAnimateKey] = useState(0);

  const handleFilterChange = (updates) => {
    const nextPrimary = updates.primary !== undefined ? updates.primary : filterPrimary;
    const nextSecondary = updates.secondary !== undefined ? updates.secondary : filterSecondary;
    const nextType = updates.type !== undefined ? updates.type : filterType;

    if (updates.primary !== undefined) setFilterPrimary(updates.primary);
    if (updates.secondary !== undefined) setFilterSecondary(updates.secondary);
    if (updates.type !== undefined) setFilterType(updates.type);

    setSelectedFeatureId(null);
    setIsInfoPanelOpen(false);

    if (map) {
      const visibleLayerIds = new Set(kmlLayers.filter(l => l.visible).map(l => l.id));
      const visibleFeatures = features.filter(feature => {
        let isVisible = true;
        if (feature.source === 'kml' && feature.layerId) {
          isVisible = visibleLayerIds.has(feature.layerId);
        }
        if (isVisible && !isFeatureMatchingUnit(feature, globalAreaUnit)) {
          isVisible = false;
        }
        if (isVisible && (nextPrimary || nextSecondary)) {
          const loc = feature.data?.location;
          if (nextSecondary) {
            if (loc && loc !== nextSecondary) isVisible = false;
          } else if (nextPrimary) {
            if (loc) {
              const validLocations = [nextPrimary, ...(CATEGORY_MAP[nextPrimary] || [])];
              if (!validLocations.includes(loc)) isVisible = false;
            }
          }
        }
        if (isVisible && nextType) {
          if (feature.data?.type !== nextType) isVisible = false;
        }
        return isVisible && feature.style?.visible !== false;
      });

      if (visibleFeatures.length > 0) {
        fitAllBounds(map, visibleFeatures);
      }
    }
  };

  // Compute visible features count
  const visibleCount = useMemo(() => {
    const visibleLayerIds = new Set(kmlLayers.filter(l => l.visible).map(l => l.id));

    return features.reduce((count, feature) => {
      let isVisible = true;
      if (feature.source === 'kml' && feature.layerId) {
        isVisible = visibleLayerIds.has(feature.layerId);
      }
      if (isVisible && !isFeatureMatchingUnit(feature, globalAreaUnit)) {
        return count;
      }

      if (isVisible && (filterPrimary || filterSecondary)) {
        const loc = feature.data?.location;
        if (filterSecondary) {
          if (loc && loc !== filterSecondary) isVisible = false;
        } else if (filterPrimary) {
          if (loc) {
            const validLocations = [filterPrimary, ...(CATEGORY_MAP[filterPrimary] || [])];
            if (!validLocations.includes(loc)) isVisible = false;
          }
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
  }, [features, kmlLayers, filterPrimary, filterSecondary, filterType, globalAreaUnit]);

  useEffect(() => {
    setAnimateKey(prev => prev + 1);
  }, [visibleCount, filterPrimary, filterSecondary, filterType, globalAreaUnit]);

  // Build dynamic map of primary categories -> sub-locations
  const dynamicCategoryMap = useMemo(() => {
    const categoryMap = {};
    const subLocationToPrimary = {};

    Object.entries(CATEGORY_MAP).forEach(([primary, subs]) => {
      subs.forEach(sub => {
        subLocationToPrimary[sub] = primary;
      });
    });

    features.forEach(f => {
      const loc = f.data?.location;
      if (loc) {
        const primary = subLocationToPrimary[loc];
        if (primary) {
          if (!categoryMap[primary]) categoryMap[primary] = new Set();
          categoryMap[primary].add(loc);
        } else {
          if (!categoryMap[loc]) categoryMap[loc] = new Set();
        }
      }
    });

    const finalMap = {};
    const sortedKeys = Object.keys(categoryMap).sort((a, b) => {
      if (a.toLowerCase() === 'surat') return -1;
      if (b.toLowerCase() === 'surat') return 1;
      return a.localeCompare(b);
    });

    sortedKeys.forEach(primary => {
      finalMap[primary] = Array.from(categoryMap[primary]).sort();
    });

    Object.entries(CATEGORY_MAP).forEach(([primary, subs]) => {
      if (!finalMap[primary]) {
        finalMap[primary] = subs;
      }
    });

    return finalMap;
  }, [features]);

  const primaryCategories = useMemo(() => {
    return Object.keys(dynamicCategoryMap).sort((a, b) => {
      if (a.toLowerCase() === 'surat') return -1;
      if (b.toLowerCase() === 'surat') return 1;
      return a.localeCompare(b);
    });
  }, [dynamicCategoryMap]);

  // Strict 3-to-4 Field Logic:
  // At the beginning (filterPrimary is null/unselected), EXACTLY 3 FIELDS ARE SHOWN (Secondary location field is HIDDEN!).
  // ONLY if the user explicitly selects Surat (filterPrimary === 'Surat'), the secondary sub-location field APPEARS!
  const isSuratExplicitlySelected = filterPrimary === 'Surat';
  const subLocationsForPrimary = useMemo(() => {
    return isSuratExplicitlySelected ? (dynamicCategoryMap['Surat'] || []) : [];
  }, [dynamicCategoryMap, isSuratExplicitlySelected]);

  const showSecondaryLocationField = isSuratExplicitlySelected && subLocationsForPrimary.length > 0;
  const isFilterActive = Boolean(filterPrimary || filterSecondary || filterType || globalAreaUnit);

  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const activeFiltersSummaryString = useMemo(() => {
    const parts = [];
    if (filterPrimary) parts.push(filterPrimary);
    else parts.push('Location');

    if (filterType) parts.push(filterType);
    else parts.push('Category');

    if (globalAreaUnit) parts.push(globalAreaUnit === 'yards' ? 'Sq.Yard' : 'Wingha');
    else parts.push('Sq.Yard');

    return parts.join(' · ');
  }, [filterPrimary, filterType, globalAreaUnit]);

  return (
    <>
      <style>{`
        @keyframes countPillPop {
          0% { transform: scale(0.85); opacity: 0.5; }
          50% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* SINGLE UNIFIED BOTTOM NOTCH DOCK CONTAINER (Matches Target Image 2 Notch Shape 100%) */}
      <div
        className="responsive-filter-bar no-scrollbar"
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          height: 60,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(10, 14, 23, 0.70)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          borderBottom: 'none',
          borderRadius: '28px 28px 0 0',
          padding: '0 24px',
          // boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.75)'
        }}
      >
        {/* Reset All Floating Button (Only appears when a filter is active) */}
        {isFilterActive && (
          <button
            type="button"
            onClick={() => {
              setFilterPrimary(null);
              setFilterSecondary(null);
              setFilterType(null);
              setGlobalAreaUnit(null);
              setSelectedFeatureId(null);
              setIsInfoPanelOpen(false);
              if (map && features.length > 0) {
                fitAllBounds(map, features);
              }
            }}
            title="Reset all applied filters"
            style={{
              position: 'absolute',
              top: -40,
              left: 175,
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 8,
              padding: '5px 14px',
              color: '#f8fafc',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <FiRefreshCw size={12} color="#f59e0b" /> Reset All
          </button>
        )}

        {/* 1. Landmarks Toggle Button */}
        <div
          onClick={toggleLandmarks}
          title={showLandmarks ? "Landmarks On (Click to turn off)" : "Landmarks Off (Click to turn on)"}
          className="filter-landmarks-toggle"
          style={{
            height: 38,
            boxSizing: 'border-box',
            border: showLandmarks ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.35)',
            background: showLandmarks ? 'rgba(245, 158, 11, 0.22)' : 'rgba(30, 41, 59, 0.5)',
            borderRadius: 10,
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 14,
            fontWeight: 600,
            color: showLandmarks ? '#f59e0b' : '#e2e8f0',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {showLandmarks ? (
            <FiEye size={16} color="#f59e0b" />
          ) : (
            <FiEyeOff size={16} color="#94a3b8" />
          )}
          <span className="desktop-only-text">Landmarks</span>
        </div>

        {/* Vertical Divider */}
        <div className="filter-divider" style={{ width: 1, height: 26, background: 'rgba(255, 255, 255, 0.18)', flexShrink: 0 }} />

        {/* 2. Primary Location Dropdown */}
        <div className="filter-dropdown-container" style={{
          height: 38,
          border: '1px solid rgba(255, 255, 255, 0.35)',
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: 10,
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          <PrimaryLocationDropdown
            primaryCategories={primaryCategories}
            value={filterPrimary}
            onChange={(cat) => handleFilterChange({ primary: cat, secondary: null })}
            placeholder="Location"
            activeColor="#f59e0b"
          />
        </div>

        <FiArrowRight size={16} color="#ffffff" className="filter-arrow-divider" style={{ flexShrink: 0 }} />

        {/* Secondary Sub-Location Dropdown */}
        {showSecondaryLocationField && (
          <>
            <div className="filter-dropdown-container" style={{
              height: 38,
              border: '1px solid rgba(255, 255, 255, 0.35)',
              background: 'rgba(30, 41, 59, 0.5)',
              borderRadius: 10,
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              boxSizing: 'border-box'
            }}>
              <SubLocationDropdown
                subLocations={subLocationsForPrimary}
                primaryName="Surat"
                value={filterSecondary}
                onChange={(sub) => handleFilterChange({ secondary: sub })}
                placeholder="Location"
                activeColor="#f59e0b"
              />
            </div>
            <FiArrowRight size={16} color="#ffffff" className="filter-arrow-divider" style={{ flexShrink: 0 }} />
          </>
        )}

        {/* 3. Unit Toggle */}
        <div style={{
          height: 38,
          border: '1px solid rgba(255, 255, 255, 0.35)',
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: 10,
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          boxSizing: 'border-box'
        }}>
          <button
            type="button"
            onClick={() => setGlobalAreaUnit(globalAreaUnit === 'yards' ? null : 'yards')}
            title="Sq.Yard unit filter"
            className="btn-hover-effect"
            style={{
              height: '100%',
              background: globalAreaUnit === 'yards' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
              color: globalAreaUnit === 'yards' ? '#000000' : '#f59e0b',
              boxShadow: globalAreaUnit === 'yards' ? '0 2px 8px rgba(245, 158, 11, 0.4)' : 'none',
              border: 'none',
              borderRadius: 8,
              padding: '0 10px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span className="desktop-only-text">Sq.Yard</span>
            <span className="mobile-only-text" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <FiSquare size={14} color={globalAreaUnit === 'yards' ? '#000000' : '#f59e0b'} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setGlobalAreaUnit(globalAreaUnit === 'wingha' ? null : 'wingha')}
            title="Wingha unit filter"
            className="btn-hover-effect"
            style={{
              height: '100%',
              background: globalAreaUnit === 'wingha' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
              color: globalAreaUnit === 'wingha' ? '#000000' : '#f59e0b',
              boxShadow: globalAreaUnit === 'wingha' ? '0 2px 8px rgba(245, 158, 11, 0.4)' : 'none',
              border: 'none',
              borderRadius: 8,
              padding: '0 10px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span className="desktop-only-text">Wingha</span>
            <span className="mobile-only-text" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <FiGrid size={14} color={globalAreaUnit === 'wingha' ? '#000000' : '#f59e0b'} />
            </span>
          </button>
        </div>

        <FiArrowRight size={16} color="#ffffff" className="filter-arrow-divider" style={{ flexShrink: 0 }} />

        {/* 4. Category Dropdown */}
        <div className="filter-dropdown-container" style={{
          height: 38,
          border: '1px solid rgba(255, 255, 255, 0.35)',
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: 10,
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          <CategoryDropdown
            options={PROPERTY_TYPES}
            value={filterType}
            onChange={(type) => handleFilterChange({ type })}
            placeholder="Category"
            activeColor="#f59e0b"
          />
        </div>

        {/* Vertical Divider */}
        <div className="filter-divider" style={{ width: 1, height: 26, background: 'rgba(255, 255, 255, 0.18)', flexShrink: 0 }} />

        {/* 5. Property Count Badge */}
        <div
          key={animateKey}
          title={`${visibleCount} matching property feature${visibleCount === 1 ? '' : 's'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            whiteSpace: 'nowrap',
            userSelect: 'none',
            padding: '0 2px'
          }}
        >
          <div style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            padding: '2px 8px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1), 0 2px 6px rgba(245, 158, 11, 0.15)'
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fbbf24', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px' }}>
              {visibleCount}
            </span>
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#cbd5e1', letterSpacing: '0.3px', marginLeft: 4 }} className="desktop-only-text">
            properties found
          </span>
        </div>

      </div>

      {/* MOBILE FILTERS DOCK NOTCH (Matches User Mockup Screenshot 100%) */}
      <div
        className="mobile-filter-dock-bar"
        onClick={() => setIsMobileSheetOpen(true)}
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100vw - 32px)',
          maxWidth: 460,
          height: 60,
          background: 'rgba(10, 14, 23, 0.70)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          borderBottom: 'none',
          borderRadius: '28px 28px 0 0',
          padding: '0 20px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 1000,
          cursor: 'pointer',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.75)'
        }}
      >
        {/* Left: Filter Icon & Subtitle Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <FiSliders size={18} color="#d9a74a" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, justifyContent: 'center' }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
              Filters
            </span>
            <span style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: '#94a3b8',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: 2
            }}>
              {activeFiltersSummaryString}
            </span>
          </div>
        </div>

        {/* Right: Count Badge (e.g. 307 found) */}
        <div style={{
          border: '1px solid rgba(245, 158, 11, 0.35)',
          background: 'rgba(245, 158, 11, 0.10)',
          borderRadius: 12,
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          flexShrink: 0
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>
            {visibleCount}
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>
            found
          </span>
        </div>
      </div>

      {/* MOBILE FILTER SHEET MODAL OVERLAY */}
      {isMobileSheetOpen && (
        <div
          onClick={() => setIsMobileSheetOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 2200,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'rgba(15, 23, 42, 0.96)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '24px 24px 0 0',
              padding: '20px 20px 32px 20px',
              boxSizing: 'border-box',
              boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              animation: 'slideUpSheet 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FiSliders size={20} color="#f59e0b" />
                <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Map Filters</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setFilterPrimary(null);
                    setFilterSecondary(null);
                    setFilterType(null);
                    setGlobalAreaUnit(null);
                    setSelectedFeatureId(null);
                    setIsInfoPanelOpen(false);
                    if (map && features.length > 0) fitAllBounds(map, features);
                  }}
                  title="Reset all applied filters"
                  style={{
                    background: isFilterActive ? 'rgba(245, 158, 11, 0.14)' : 'transparent',
                    border: isFilterActive ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(255, 255, 255, 0.15)',
                    color: isFilterActive ? '#f59e0b' : '#94a3b8',
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.2s'
                  }}
                >
                  <FiRefreshCw size={12} /> Reset All
                </button>

                <button
                  type="button"
                  onClick={() => setIsMobileSheetOpen(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                >
                  <FiX size={20} color="#94a3b8" />
                </button>
              </div>
            </div>

            {/* Filter Controls Stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
              {/* Primary Location */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Primary Location</label>
                <div style={{
                  height: 42, border: '1px solid rgba(255, 255, 255, 0.2)', background: 'rgba(30, 41, 59, 0.6)',
                  borderRadius: 12, padding: '0 14px', display: 'flex', alignItems: 'center'
                }}>
                  <PrimaryLocationDropdown
                    primaryCategories={primaryCategories}
                    value={filterPrimary}
                    onChange={(cat) => handleFilterChange({ primary: cat, secondary: null })}
                    placeholder="All Locations"
                    activeColor="#f59e0b"
                    isInModal={true}
                  />
                </div>
              </div>

              {/* Sub Location */}
              {showSecondaryLocationField && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Sub Location (Surat)</label>
                  <div style={{
                    height: 42, border: '1px solid rgba(255, 255, 255, 0.2)', background: 'rgba(30, 41, 59, 0.6)',
                    borderRadius: 12, padding: '0 14px', display: 'flex', alignItems: 'center'
                  }}>
                    <SubLocationDropdown
                      subLocations={subLocationsForPrimary}
                      primaryName="Surat"
                      value={filterSecondary}
                      onChange={(sub) => handleFilterChange({ secondary: sub })}
                      placeholder="All Sub Locations"
                      activeColor="#f59e0b"
                      isInModal={true}
                    />
                  </div>
                </div>
              )}

              {/* Category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Property Category</label>
                <div style={{
                  height: 42, border: '1px solid rgba(255, 255, 255, 0.2)', background: 'rgba(30, 41, 59, 0.6)',
                  borderRadius: 12, padding: '0 14px', display: 'flex', alignItems: 'center'
                }}>
                  <CategoryDropdown
                    options={PROPERTY_TYPES}
                    value={filterType}
                    onChange={(type) => handleFilterChange({ type })}
                    placeholder="All Categories"
                    activeColor="#f59e0b"
                    isInModal={true}
                  />
                </div>
              </div>

              {/* Unit Toggle & Landmarks */}
              <div style={{ display: 'flex', gap: 10 }}>
                {/* Unit Toggle */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Area Unit</label>
                  <div style={{
                    height: 42, border: '1px solid rgba(255, 255, 255, 0.2)', background: 'rgba(30, 41, 59, 0.6)',
                    borderRadius: 12, padding: 3, display: 'flex', gap: 4
                  }}>
                    <button
                      type="button"
                      onClick={() => setGlobalAreaUnit(globalAreaUnit === 'yards' ? null : 'yards')}
                      style={{
                        flex: 1, border: 'none', borderRadius: 9,
                        background: globalAreaUnit === 'yards' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
                        color: globalAreaUnit === 'yards' ? '#000000' : '#f59e0b',
                        fontWeight: 700, fontSize: 12.5, cursor: 'pointer'
                      }}
                    >
                      Sq.Yard
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlobalAreaUnit(globalAreaUnit === 'wingha' ? null : 'wingha')}
                      style={{
                        flex: 1, border: 'none', borderRadius: 9,
                        background: globalAreaUnit === 'wingha' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
                        color: globalAreaUnit === 'wingha' ? '#000000' : '#f59e0b',
                        fontWeight: 700, fontSize: 12.5, cursor: 'pointer'
                      }}
                    >
                      Wingha
                    </button>
                  </div>
                </div>

                {/* Landmarks */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Landmarks</label>
                  <button
                    type="button"
                    onClick={toggleLandmarks}
                    style={{
                      height: 42, border: showLandmarks ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.2)',
                      background: showLandmarks ? 'rgba(245, 158, 11, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                      color: showLandmarks ? '#f59e0b' : '#94a3b8',
                      borderRadius: 12, fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    {showLandmarks ? <FiEye size={16} /> : <FiEyeOff size={16} />}
                    {showLandmarks ? 'Landmarks On' : 'Landmarks Off'}
                  </button>
                </div>
              </div>

              {/* Action Button: Show Properties (Full Width) */}
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsMobileSheetOpen(false)}
                  style={{
                    width: '100%', padding: '13px 0', border: 'none',
                    background: '#f59e0b', color: '#000000', borderRadius: 12,
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
                  }}
                >
                  Show {visibleCount} Properties
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
