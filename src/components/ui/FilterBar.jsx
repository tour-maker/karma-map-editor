import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { PROPERTY_TYPE_COLORS, buildDynamicLocationMap, getCategoryOptionsForUnit, buildLocationCategoryMatrix, getCategoriesForLocation, getLocationsForCategory } from '../../config/categories';
import { useGoogleMap } from '../../context/GoogleMapContext';
import { fitAllBounds } from '../../services/googleMaps';
import { FiChevronDown, FiChevronUp, FiRefreshCw, FiEye, FiEyeOff, FiArrowRight, FiMapPin, FiNavigation, FiTag, FiSquare, FiGrid, FiSliders, FiX, FiType } from 'react-icons/fi';
import { isFeatureMatchingUnit } from '../../utils/unitFilter';
import { glassPanelStyle, GLASS_COLORS, GLASS_RADIUS, GLASS_SHADOW, GLASS_BLUR, GOLD_GRADIENT, GOLD_GRADIENT_SHADOW, GLASS_FONT } from '../../styles/glass';

const countPillStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  padding: '6px 14px',
  borderRadius: 999,
  background: 'rgba(10, 14, 23, 0.85)',
  border: '1px solid rgba(253, 183, 19, 0.35)',
  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.35)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  flexShrink: 0
};

const mobileChipStyle = (active) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 999,
  border: active ? `1px solid ${GLASS_COLORS.borderActive}` : '1px solid rgba(255, 255, 255, 0.22)',
  background: active ? 'rgba(245, 158, 11, 0.22)' : 'rgba(10, 14, 23, 0.78)',
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  color: active ? '#f59e0b' : '#e2e8f0',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
});

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
function PrimaryLocationDropdown({ primaryCategories, value, onChange, placeholder = 'Location', activeColor = '#f59e0b', isInModal = false, onOpenChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

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
    <div ref={ref} style={{ position: 'relative', width: isInModal ? '100%' : 'auto', height: '100%' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          color: '#f59e0b',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          // Trigger fills the whole bordered container so the first click anywhere on it opens the menu
          padding: isInModal ? '0 14px' : '0 10px',
          height: '100%',
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
        <div style={{
          ...glassPanelStyle,
          position: 'absolute',
          ...(isInModal ? {
            top: '100%', left: 0, right: 0, width: '100%', marginTop: 6, zIndex: 3000, boxSizing: 'border-box'
          } : {
            bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 16, minWidth: 190, zIndex: 1100
          }),
          padding: 8,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <input
            type="text"
            placeholder="Search location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="karma-auth-input"
            onFocus={(e) => { e.target.style.borderColor = '#FDB713'; e.target.style.boxShadow = '0 0 0 3px rgba(253,183,19,0.18)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(253,183,19,0.25)'; e.target.style.boxShadow = 'none'; }}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(253,183,19,0.25)',
              borderRadius: GLASS_RADIUS.control,
              padding: '6px 10px',
              color: '#f1f5f9',
              fontSize: 13,
              fontWeight: 400,
              outline: 'none',
              marginBottom: 8,
              width: '100%',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s, box-shadow 0.15s'
            }}
          />

          <div style={{
            maxHeight: isInModal ? 180 : 240,
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
                borderRadius: GLASS_RADIUS.control,
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
              <div style={{ padding: '8px 12px', color: '#64748b', fontSize: 12, fontWeight: 400, textAlign: 'center' }}>
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
                    borderRadius: GLASS_RADIUS.control,
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
function SubLocationDropdown({ subLocations, primaryName, value, onChange, placeholder = 'Location', activeColor = '#f59e0b', isInModal = false, onOpenChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

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
    <div ref={ref} style={{ position: 'relative', width: isInModal ? '100%' : 'auto', height: '100%' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          color: '#f59e0b',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          // Trigger fills the whole bordered container so the first click anywhere on it opens the menu
          padding: isInModal ? '0 14px' : '0 10px',
          height: '100%',
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
        <div style={{
          ...glassPanelStyle,
          position: 'absolute',
          ...(isInModal ? {
            top: '100%', left: 0, right: 0, width: '100%', marginTop: 6, zIndex: 3000, boxSizing: 'border-box'
          } : {
            bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 16, minWidth: 180, zIndex: 1100
          }),
          padding: 8,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <input
            type="text"
            placeholder={`Search in ${primaryName}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="karma-auth-input"
            onFocus={(e) => { e.target.style.borderColor = '#FDB713'; e.target.style.boxShadow = '0 0 0 3px rgba(253,183,19,0.18)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(253,183,19,0.25)'; e.target.style.boxShadow = 'none'; }}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(253,183,19,0.25)',
              borderRadius: GLASS_RADIUS.control,
              padding: '6px 10px',
              color: '#f1f5f9',
              fontSize: 13,
              fontWeight: 400,
              outline: 'none',
              marginBottom: 8,
              width: '100%',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s, box-shadow 0.15s'
            }}
          />

          <div style={{
            maxHeight: isInModal ? 180 : 240,
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
                borderRadius: GLASS_RADIUS.control,
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
              <div style={{ padding: '8px 12px', color: '#64748b', fontSize: 12, fontWeight: 400, textAlign: 'center' }}>
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
                    borderRadius: GLASS_RADIUS.control,
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
function CategoryDropdown({ options, value, onChange, placeholder = 'Category', activeColor = '#f59e0b', isInModal = false, onOpenChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

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
    <div ref={ref} style={{ position: 'relative', width: isInModal ? '100%' : 'auto', height: '100%' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          color: '#f59e0b',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          // Trigger fills the whole bordered container so the first click anywhere on it opens the menu
          padding: isInModal ? '0 14px' : '0 10px',
          height: '100%',
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
        <div style={{
          ...glassPanelStyle,
          position: 'absolute',
          ...(isInModal ? {
            top: '100%', left: 0, right: 0, width: '100%', marginTop: 6, zIndex: 3000, boxSizing: 'border-box'
          } : {
            bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 16, minWidth: 200, zIndex: 1100
          }),
          padding: 8,
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
              borderRadius: GLASS_RADIUS.control,
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
                  borderRadius: GLASS_RADIUS.control,
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
  const showLabels = useMapStore(state => state.showLabels);

  const setFilterPrimary = useMapStore(state => state.setFilterPrimary);
  const setFilterSecondary = useMapStore(state => state.setFilterSecondary);
  const setFilterType = useMapStore(state => state.setFilterType);
  const setGlobalAreaUnit = useMapStore(state => state.setGlobalAreaUnit);
  const toggleLandmarks = useMapStore(state => state.toggleLandmarks);
  const toggleLabels = useMapStore(state => state.toggleLabels);
  const setSelectedFeatureId = useMapStore(state => state.setSelectedFeatureId);
  const setIsInfoPanelOpen = useMapStore(state => state.setIsInfoPanelOpen);
  const map = useGoogleMap();

  const features = useMapStore(state => state.features);

  // Build dynamic map of primary categories -> sub-locations, from live feature data
  const dynamicCategoryMap = useMemo(() => {
    return buildDynamicLocationMap(features);
  }, [features]);

  // Live Location <-> Category matrix, derived straight from the actual features —
  // no per-location config. Recomputes automatically as properties are added,
  // removed or recategorized in the sheet.
  const locationCategoryMatrix = useMemo(() => buildLocationCategoryMatrix(features), [features]);

  const [animateKey, setAnimateKey] = useState(0);

  const handleFilterChange = (updates) => {
    let nextPrimary = updates.primary !== undefined ? updates.primary : filterPrimary;
    let nextSecondary = updates.secondary !== undefined ? updates.secondary : filterSecondary;
    const nextAreaUnit = updates.areaUnit !== undefined ? updates.areaUnit : globalAreaUnit;
    let nextType = updates.type !== undefined ? updates.type : filterType;

    // Clear the selected category if it doesn't apply to the newly selected area unit
    if (updates.areaUnit !== undefined && nextType && !getCategoryOptionsForUnit(nextAreaUnit).includes(nextType)) {
      nextType = null;
    }

    // Location -> Category: clear an already-active category that has zero properties
    // in the newly selected location (secondary sub-location if set, else the primary)
    if ((updates.primary !== undefined || updates.secondary !== undefined) && nextType) {
      const allowedCategories = getCategoriesForLocation(locationCategoryMatrix, nextSecondary || nextPrimary);
      if (allowedCategories && !allowedCategories.includes(nextType)) {
        nextType = null;
      }
    }

    // Category -> Location (reverse of the above): clear an already-active location
    // that has zero properties in the newly selected category
    if (updates.type !== undefined && nextPrimary) {
      const allowedLocations = getLocationsForCategory(locationCategoryMatrix, nextType);
      if (allowedLocations && !allowedLocations.includes(nextPrimary)) {
        nextPrimary = null;
        nextSecondary = null;
      }
    }

    if (updates.primary !== undefined) setFilterPrimary(updates.primary);
    else if (nextPrimary !== filterPrimary) setFilterPrimary(nextPrimary);
    if (updates.secondary !== undefined) setFilterSecondary(updates.secondary);
    if (updates.type !== undefined || nextType !== filterType) setFilterType(nextType);
    if (updates.areaUnit !== undefined) setGlobalAreaUnit(updates.areaUnit);

    setSelectedFeatureId(null);
    setIsInfoPanelOpen(false);

    if (map) {
      const visibleFeatures = features.filter(feature => {
        let isVisible = true;
        if (isVisible && !isFeatureMatchingUnit(feature, nextAreaUnit)) {
          isVisible = false;
        }
        if (isVisible && (nextPrimary || nextSecondary)) {
          const loc = feature.data?.location;
          if (nextSecondary) {
            if (loc && loc !== nextSecondary) isVisible = false;
          } else if (nextPrimary) {
            if (loc) {
              const validLocations = [nextPrimary, ...(dynamicCategoryMap[nextPrimary] || [])];
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
    return features.reduce((count, feature) => {
      // Exclude dedicated landmarks so only polygons/properties are counted
      if (feature.id?.startsWith('landmark-') || feature.data?.type === 'Landmark') {
        return count;
      }

      let isVisible = true;
      if (isVisible && !isFeatureMatchingUnit(feature, globalAreaUnit)) {
        return count;
      }

      if (isVisible && (filterPrimary || filterSecondary)) {
        const loc = feature.data?.location;
        if (filterSecondary) {
          if (loc && loc !== filterSecondary) isVisible = false;
        } else if (filterPrimary) {
          if (loc) {
            const validLocations = [filterPrimary, ...(dynamicCategoryMap[filterPrimary] || [])];
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
  }, [features, filterPrimary, filterSecondary, filterType, globalAreaUnit]);

  useEffect(() => {
    setAnimateKey(prev => prev + 1);
  }, [visibleCount, filterPrimary, filterSecondary, filterType, globalAreaUnit]);

  // Locations with zero properties in the active category are filtered out here — computed
  // live from locationCategoryMatrix, so it never needs a per-location config entry.
  const primaryCategories = useMemo(() => {
    const allowedLocations = getLocationsForCategory(locationCategoryMatrix, filterType);
    const base = Object.keys(dynamicCategoryMap);
    return (allowedLocations ? base.filter(loc => allowedLocations.includes(loc)) : base)
      .sort((a, b) => {
        if (a.toLowerCase() === 'surat') return -1;
        if (b.toLowerCase() === 'surat') return 1;
        return a.localeCompare(b);
      });
  }, [dynamicCategoryMap, locationCategoryMatrix, filterType]);

  // Secondary location field appears whenever the selected primary location actually
  // has sub-locations in the live data (not just Surat — e.g. "NH 48 , Palsana" too).
  const subLocationsForPrimary = useMemo(() => {
    return filterPrimary ? (dynamicCategoryMap[filterPrimary] || []) : [];
  }, [dynamicCategoryMap, filterPrimary]);

  const showSecondaryLocationField = Boolean(filterPrimary) && subLocationsForPrimary.length > 0;

  // Categories with zero properties in the active location (sub-location takes precedence
  // over the broader primary when both are set) are filtered out — also live from the matrix.
  const categoryOptions = useMemo(() => {
    const options = getCategoryOptionsForUnit(globalAreaUnit);
    const allowedCategories = getCategoriesForLocation(locationCategoryMatrix, filterSecondary || filterPrimary);
    return allowedCategories ? options.filter(t => allowedCategories.includes(t)) : options;
  }, [globalAreaUnit, locationCategoryMatrix, filterPrimary, filterSecondary]);
  const isFilterActive = Boolean(filterPrimary || filterSecondary || filterType || globalAreaUnit);

  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // While any desktop dropdown is open the whole dock is lifted above sibling overlays
  // (right dock, WhatsApp CTA, top bars) so the menu is never partially covered.
  const [openDropdown, setOpenDropdown] = useState(null);
  const trackDropdown = useCallback((name, open) => {
    setOpenDropdown(prev => (open ? name : (prev === name ? null : prev)));
  }, []);
  const onPrimaryOpen = useCallback((open) => trackDropdown('primary', open), [trackDropdown]);
  const onSubOpen = useCallback((open) => trackDropdown('sub', open), [trackDropdown]);
  const onCategoryOpen = useCallback((open) => trackDropdown('category', open), [trackDropdown]);

  const handleResetAll = () => {
    setFilterPrimary(null);
    setFilterSecondary(null);
    setFilterType(null);
    setGlobalAreaUnit(null);
    setSelectedFeatureId(null);
    setIsInfoPanelOpen(false);
    if (map && features.length > 0) {
      fitAllBounds(map, features);
    }
  };

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
          zIndex: openDropdown ? 1250 : 1000,
          height: 60,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: GLASS_COLORS.panelBg,
          backdropFilter: GLASS_BLUR,
          WebkitBackdropFilter: GLASS_BLUR,
          border: `1px solid ${GLASS_COLORS.border}`,
          borderBottom: 'none',
          borderRadius: '28px 28px 0 0',
          padding: '0 24px',
          boxShadow: GLASS_SHADOW
        }}
      >
        {/* Reset All Floating Button (Only appears when a filter is active) */}
        {isFilterActive && (
          <button
            type="button"
            onClick={handleResetAll}
            title="Reset all applied filters"
            style={{
              position: 'absolute',
              top: -40,
              left: '50%',
              transform: 'translateX(-50%)',
              ...glassPanelStyle,
              borderRadius: GLASS_RADIUS.control,
              padding: '5px 14px',
              color: '#f8fafc',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
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
            border: showLandmarks ? `2px solid ${GLASS_COLORS.borderActive}` : `1px solid ${GLASS_COLORS.border}`,
            background: showLandmarks ? 'rgba(245, 158, 11, 0.22)' : 'rgba(30, 41, 59, 0.5)',
            borderRadius: GLASS_RADIUS.control,
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

        {/* 1b. Map Labels Toggle Button */}
        <div
          onClick={toggleLabels}
          title={showLabels ? "Map Labels On (Click to turn off)" : "Map Labels Off (Click to turn on)"}
          className="filter-labels-toggle"
          style={{
            height: 38,
            boxSizing: 'border-box',
            border: showLabels ? `2px solid ${GLASS_COLORS.borderActive}` : `1px solid ${GLASS_COLORS.border}`,
            background: showLabels ? 'rgba(245, 158, 11, 0.22)' : 'rgba(30, 41, 59, 0.5)',
            borderRadius: GLASS_RADIUS.control,
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 14,
            fontWeight: 600,
            color: showLabels ? '#f59e0b' : '#e2e8f0',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <FiType size={16} color={showLabels ? '#f59e0b' : '#94a3b8'} />
          <span className="desktop-only-text">Labels</span>
        </div>

        {/* Vertical Divider */}
        <div className="filter-divider" style={{ width: 1, height: 26, background: 'rgba(255, 255, 255, 0.18)', flexShrink: 0 }} />

        {/* 2. Primary Location Dropdown */}
        <div className="filter-dropdown-container" style={{
          height: 38,
          border: `1px solid ${GLASS_COLORS.border}`,
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: 10,
          padding: 0,
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
            onOpenChange={onPrimaryOpen}
          />
        </div>

        <FiArrowRight size={16} color="#ffffff" className="filter-arrow-divider" style={{ flexShrink: 0 }} />

        {/* Secondary Sub-Location Dropdown */}
        {showSecondaryLocationField && (
          <>
            <div className="filter-dropdown-container" style={{
              height: 38,
              border: `1px solid ${GLASS_COLORS.border}`,
              background: 'rgba(30, 41, 59, 0.5)',
              borderRadius: 10,
              padding: 0,
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
                onOpenChange={onSubOpen}
              />
            </div>
            <FiArrowRight size={16} color="#ffffff" className="filter-arrow-divider" style={{ flexShrink: 0 }} />
          </>
        )}

        {/* 3. Unit Toggle */}
        <div style={{
          height: 38,
          border: `1px solid ${GLASS_COLORS.border}`,
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
            onClick={() => handleFilterChange({ areaUnit: globalAreaUnit === 'yards' ? null : 'yards' })}
            title="Sq.Yard unit filter"
            className="btn-hover-effect"
            style={{
              height: '100%',
              background: globalAreaUnit === 'yards' ? GOLD_GRADIENT : 'transparent',
              color: globalAreaUnit === 'yards' ? '#1c1406' : '#f59e0b',
              boxShadow: globalAreaUnit === 'yards' ? GOLD_GRADIENT_SHADOW : 'none',
              border: 'none',
              borderRadius: GLASS_RADIUS.control,
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
            onClick={() => handleFilterChange({ areaUnit: globalAreaUnit === 'wingha' ? null : 'wingha' })}
            title="Wingha unit filter"
            className="btn-hover-effect"
            style={{
              height: '100%',
              background: globalAreaUnit === 'wingha' ? GOLD_GRADIENT : 'transparent',
              color: globalAreaUnit === 'wingha' ? '#1c1406' : '#f59e0b',
              boxShadow: globalAreaUnit === 'wingha' ? GOLD_GRADIENT_SHADOW : 'none',
              border: 'none',
              borderRadius: GLASS_RADIUS.control,
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
          border: `1px solid ${GLASS_COLORS.border}`,
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: 10,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          <CategoryDropdown
            options={categoryOptions}
            value={filterType}
            onChange={(type) => handleFilterChange({ type })}
            placeholder="Category"
            activeColor="#f59e0b"
            onOpenChange={onCategoryOpen}
          />
        </div>

        {/* Vertical Divider */}
        <div className="filter-divider" style={{ width: 1, height: 26, background: 'rgba(255, 255, 255, 0.18)', flexShrink: 0 }} />

        {/* 5. Property Count Badge — dark pill: icon + bold number + "found" */}
        <div
          key={animateKey}
          title={`${visibleCount} matching property feature${visibleCount === 1 ? '' : 's'}`}
          style={countPillStyle}
        >
          <FiMapPin size={15} color="#FDB713" />
          <span style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
            {visibleCount}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: '#94a3b8' }}>found</span>
        </div>

      </div>

      {/* MOBILE: Landmarks + Map Labels toggles, sitting above the Filters dock */}
      {!isMobileSheetOpen && (
        <div
          className="mobile-toggle-chips"
          style={{ position: 'fixed', bottom: 70, left: 16, zIndex: 1000, gap: 8 }}
        >
          <button type="button" onClick={toggleLandmarks} style={mobileChipStyle(showLandmarks)}>
            {showLandmarks ? <FiEye size={14} /> : <FiEyeOff size={14} />}
            Landmarks
          </button>
          <button type="button" onClick={toggleLabels} style={mobileChipStyle(showLabels)}>
            <FiType size={14} />
            Labels
          </button>
        </div>
      )}

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
          background: GLASS_COLORS.panelBg,
          backdropFilter: GLASS_BLUR,
          WebkitBackdropFilter: GLASS_BLUR,
          border: `1px solid ${GLASS_COLORS.border}`,
          borderBottom: 'none',
          borderRadius: '28px 28px 0 0',
          padding: '0 20px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 1000,
          cursor: 'pointer',
          boxShadow: GLASS_SHADOW
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
        <div style={{ ...countPillStyle, padding: '5px 12px' }}>
          <FiMapPin size={14} color="#FDB713" />
          <span style={{ fontSize: 13.5, fontWeight: 800, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
            {visibleCount}
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>found</span>
        </div>
      </div>

      {/* MOBILE FILTER SHEET OVERLAY — transparent + click-through so the map above the sheet stays pannable/clickable */}
      {isMobileSheetOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'transparent',
            pointerEvents: 'none',
            zIndex: 2200,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...glassPanelStyle,
              pointerEvents: 'auto',
              width: '100%',
              maxWidth: 480,
              borderRadius: `${GLASS_RADIUS.panel}px ${GLASS_RADIUS.panel}px 0 0`,
              padding: '20px 20px 32px 20px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              animation: 'slideUpSheet 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Reset All sits before the title, and only exists while something is selected */}
                {isFilterActive && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    title="Reset all applied filters"
                    style={{
                      background: 'rgba(245, 158, 11, 0.14)',
                      border: `1px solid ${GLASS_COLORS.borderActive}`,
                      color: '#f59e0b',
                      borderRadius: GLASS_RADIUS.control,
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <FiRefreshCw size={12} /> Reset All
                  </button>
                )}
                <FiSliders size={20} color="#f59e0b" />
                <span style={{ fontSize: 18, color: '#ffffff', ...GLASS_FONT.serif }}>Map Filters</span>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileSheetOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
              >
                <FiX size={20} color="#94a3b8" />
              </button>
            </div>

            {/* Filter Controls Stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
              {/* Primary Location */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Primary Location</label>
                <div style={{
                  height: 42, border: `1px solid ${GLASS_COLORS.border}`, background: 'rgba(30, 41, 59, 0.6)',
                  borderRadius: GLASS_RADIUS.control, padding: 0, display: 'flex', alignItems: 'center'
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
                    height: 42, border: `1px solid ${GLASS_COLORS.border}`, background: 'rgba(30, 41, 59, 0.6)',
                    borderRadius: GLASS_RADIUS.control, padding: 0, display: 'flex', alignItems: 'center'
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
                  height: 42, border: `1px solid ${GLASS_COLORS.border}`, background: 'rgba(30, 41, 59, 0.6)',
                  borderRadius: GLASS_RADIUS.control, padding: 0, display: 'flex', alignItems: 'center'
                }}>
                  <CategoryDropdown
                    options={categoryOptions}
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
                <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Area Unit</label>
                  <div style={{
                    height: 42, border: `1px solid ${GLASS_COLORS.border}`, background: 'rgba(30, 41, 59, 0.6)',
                    borderRadius: GLASS_RADIUS.control, padding: 3, display: 'flex', gap: 4
                  }}>
                    <button
                      type="button"
                      onClick={() => handleFilterChange({ areaUnit: globalAreaUnit === 'yards' ? null : 'yards' })}
                      style={{
                        flex: 1, border: 'none', borderRadius: 9,
                        background: globalAreaUnit === 'yards' ? GOLD_GRADIENT : 'transparent',
                        color: globalAreaUnit === 'yards' ? '#1c1406' : '#f59e0b',
                        boxShadow: globalAreaUnit === 'yards' ? GOLD_GRADIENT_SHADOW : 'none',
                        fontWeight: 700, fontSize: 12.5, cursor: 'pointer'
                      }}
                    >
                      Sq.Yard
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFilterChange({ areaUnit: globalAreaUnit === 'wingha' ? null : 'wingha' })}
                      style={{
                        flex: 1, border: 'none', borderRadius: 9,
                        background: globalAreaUnit === 'wingha' ? GOLD_GRADIENT : 'transparent',
                        color: globalAreaUnit === 'wingha' ? '#1c1406' : '#f59e0b',
                        boxShadow: globalAreaUnit === 'wingha' ? GOLD_GRADIENT_SHADOW : 'none',
                        fontWeight: 700, fontSize: 12.5, cursor: 'pointer'
                      }}
                    >
                      Wingha
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Button: Show Properties (Full Width) */}
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsMobileSheetOpen(false)}
                  style={{
                    width: '100%', padding: '13px 0', border: 'none',
                    background: GOLD_GRADIENT, color: '#1c1406', borderRadius: GLASS_RADIUS.control,
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    boxShadow: GOLD_GRADIENT_SHADOW
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
