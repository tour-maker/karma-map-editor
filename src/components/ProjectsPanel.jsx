import { useState, useMemo, useRef, useCallback } from 'react';
import { FiSearch, FiPlus, FiChevronDown, FiChevronRight, FiMapPin, FiX, FiLayers, FiGlobe, FiMenu } from 'react-icons/fi';
import { FaFileExcel } from 'react-icons/fa';
import { useMapStore } from '../store/useMapStore';
import { CATEGORY_MAP, determineParentLocation, getPropertyTypeColor } from '../config/categories';
import { useVirtualizer } from '@tanstack/react-virtual';
import GoogleSheetsConnect from './GoogleSheetsConnect';
import AddAreaModal from './AddAreaModal';
import { useGoogleMap } from '../context/GoogleMapContext';
import { zoomToProperty, fitAllBounds } from '../services/googleMaps';
import { cleanLandmarkTitle, resolveLandmarkLocation } from './LandmarkManager';

// Inject Custom Scrollbar for Projects Panel
if (typeof document !== 'undefined' && !document.getElementById('projects-panel-scrollbar-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'projects-panel-scrollbar-styles';
  styleEl.innerHTML = `
    .projects-list-scroll::-webkit-scrollbar {
      width: 5px;
    }
    .projects-list-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .projects-list-scroll::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.25);
      border-radius: 4px;
    }
    .projects-list-scroll::-webkit-scrollbar-thumb:hover {
      background: rgba(148, 163, 184, 0.45);
    }
  `;
  document.head.appendChild(styleEl);
}

export function getProjectDisplayParts(feature) {
  if (!feature) return { locationTitle: 'Untitled', areaTitle: '', tpOpFpTitle: '' };
  const d = feature.data || {};

  const rawLoc = d.location || d.subLocation || d.landmark || '';
  const parentLoc = d.parentLocation || d.parent_location || determineParentLocation(rawLoc);

  let locationTitle = '';
  if (parentLoc && rawLoc && parentLoc !== rawLoc) {
    locationTitle = `${parentLoc} | ${rawLoc}`;
  } else if (rawLoc) {
    locationTitle = rawLoc;
  } else if (parentLoc) {
    locationTitle = parentLoc;
  } else {
    locationTitle = '_';
  }

  let areaTitle = '_';
  if (d.area != null && d.area !== '' && !isNaN(Number(d.area))) {
    areaTitle = `${d.area} sq. yard`;
  } else if (typeof d.area === 'string' && d.area.trim()) {
    areaTitle = d.area.toLowerCase().includes('sq') ? d.area : `${d.area} sq. yard`;
  }

  let tpVal = d.tp;
  let opVal = d.op;
  let fpVal = d.fp;

  if (!tpVal && d.name) {
    const match = d.name.match(/TP[:\s]*([A-Z0-9\/]+)/i);
    if (match) tpVal = match[1];
  }
  if (!opVal && d.name) {
    const match = d.name.match(/OP[:\s]*([A-Z0-9\/]+)/i);
    if (match) opVal = match[1];
  }
  if (!fpVal && d.name) {
    const match = d.name.match(/FP[:\s]*([A-Z0-9\/]+)/i);
    if (match) fpVal = match[1];
  }

  const tpOpFpTitle = `TP: ${tpVal || '_'}   |   OP: ${opVal || '_'}   |   FP: ${fpVal || '_'}`;

  return { locationTitle, areaTitle, tpOpFpTitle };
}

export function formatProjectDisplayName(feature) {
  const parts = getProjectDisplayParts(feature);
  return `${parts.locationTitle} | ${parts.areaTitle} | ${parts.tpOpFpTitle}`;
}

export default function ProjectsPanel({ onAddProject, onAddLandmark }) {
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'landmarks'
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);
  const appMode = useMapStore(state => state.appMode);
  const features = useMapStore(state => state.features);
  const selectedFeatureId = useMapStore(state => state.selectedFeatureId);
  const selectedAreaName = useMapStore(state => state.selectedAreaName);
  const setSelectedFeatureId = useMapStore(state => state.setSelectedFeatureId);
  const setSelectedAreaName = useMapStore(state => state.setSelectedAreaName);
  const setIsInfoPanelOpen = useMapStore(state => state.setIsInfoPanelOpen);
  const theme = useMapStore(state => state.theme);
  const map = useGoogleMap();

  const isDark = theme === 'dark';

  // Dynamic Sidebar Glassmorphic Design
  const sidebarStyle = {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 1000,
    width: 380,
    maxHeight: 'calc(100vh - 32px)',
    display: 'flex',
    flexDirection: 'column',
    background: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.94)',
    borderRadius: 18,
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
    boxSizing: 'border-box',
    backdropFilter: 'blur(16px)',
    border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(226, 232, 240, 0.8)',
    overflow: 'hidden',
    overflowX: 'hidden',
    transition: 'all 0.25s ease',
    color: isDark ? '#f8fafc' : '#0f172a'
  };

  const headerBg = isDark ? 'rgba(15, 23, 42, 0.95)' : '#f8fafc';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';

  const filterPrimary = useMapStore(state => state.filterPrimary);
  const filterSecondary = useMapStore(state => state.filterSecondary);
  const filterType = useMapStore(state => state.filterType);
  const kmlLayers = useMapStore(state => state.kmlLayers);
  const customAreas = useMapStore(state => state.customAreas) || [];
  const setFilterPrimary = useMapStore(state => state.setFilterPrimary);
  const [isAddingArea, setIsAddingArea] = useState(false);

  // Show all visible features in the panel, filtered by global map filters
  const polygons = useMemo(() => {
    const visibleLayerIds = new Set(kmlLayers.filter(l => l.visible).map(l => l.id));

    return features.filter(feature => {
      // Exclude dedicated landmarks from Projects tab (they belong in Landmarks tab)
      if (feature.id?.startsWith('landmark-') || feature.data?.type === 'Landmark') {
        return false;
      }

      const d = feature.data || {};
      const hasContent = Boolean(
        (d.location && d.location.trim()) ||
        (d.parentLocation && d.parentLocation.trim()) ||
        (d.name && d.name !== 'polygon' && d.name !== 'marker' && d.name.trim()) ||
        (d.tp && d.tp.trim()) ||
        (d.op && d.op.trim()) ||
        (d.fp && d.fp.trim()) ||
        (d.landmark && d.landmark.trim()) ||
        (d.area != null && d.area !== '')
      );

      if (!hasContent) return false;

      let isVisible = true;
      if (feature.source === 'kml' && feature.layerId) {
        isVisible = visibleLayerIds.has(feature.layerId);
      }

      if (isVisible && (filterPrimary || filterSecondary)) {
        const loc = feature.data?.location;
        if (filterSecondary) {
          if (loc !== filterSecondary) isVisible = false;
        } else if (filterPrimary) {
          const validLocations = [filterPrimary, ...(CATEGORY_MAP[filterPrimary] || [])];
          if (!validLocations.includes(loc)) isVisible = false;
        }
      }

      if (isVisible && filterType) {
        if (feature.data?.type !== filterType) isVisible = false;
      }

      return isVisible && feature.style?.visible !== false;
    });
  }, [features, kmlLayers, filterPrimary, filterSecondary, filterType]);

  // Extract unique landmarks for the Landmarks tab
  const landmarksList = useMemo(() => {
    const visibleLayerIds = new Set(kmlLayers.filter(l => l.visible).map(l => l.id));
    const seen = new Set();
    const list = [];

    features.forEach(f => {
      const isLandmarkType = f.data?.type === 'Landmark' || f.id?.startsWith('landmark-');
      if (!isLandmarkType) return;

      let isVisible = true;
      if (f.source === 'kml' && f.layerId) {
        isVisible = visibleLayerIds.has(f.layerId);
      }
      if (!isVisible || f.style?.visible === false) return;

      const title = cleanLandmarkTitle(f.data?.name || 'Landmark');
      if (!title) return;
      const key = title.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const loc = f.data?.location || 'Surat';
      const parentLoc = f.data?.parentLocation || determineParentLocation(loc);

      list.push({
        id: f.id,
        title,
        location: loc,
        parentLocation: parentLoc,
        feature: f
      });
    });

    return list;
  }, [features, kmlLayers]);

  // Extract all Parent Locations for the Area tab
  const parentLocationsList = useMemo(() => {
    const parentMap = new Map();

    // 1. Defaults from CATEGORY_MAP
    Object.keys(CATEGORY_MAP).forEach(parent => {
      parentMap.set(parent, {
        name: parent,
        subLocations: CATEGORY_MAP[parent] || [],
        features: []
      });
    });

    // 2. Custom areas from store
    customAreas.forEach(parent => {
      if (!parentMap.has(parent)) {
        parentMap.set(parent, {
          name: parent,
          subLocations: CATEGORY_MAP[parent] || [],
          features: []
        });
      }
    });

    // 3. Scan map features for parent locations
    features.forEach(f => {
      if (f.style?.visible === false) return;
      const d = f.data || {};
      const parentLoc = d.parentLocation || d.parent_location || determineParentLocation(d.location);
      if (parentLoc) {
        if (!parentMap.has(parentLoc)) {
          parentMap.set(parentLoc, {
            name: parentLoc,
            subLocations: CATEGORY_MAP[parentLoc] || [],
            features: []
          });
        }
        parentMap.get(parentLoc).features.push(f);
      }
    });

    const list = Array.from(parentMap.values()).map(item => ({
      ...item,
      count: item.features.length
    }));

    list.sort((a, b) => {
      if (a.name.toLowerCase() === 'surat') return -1;
      if (b.name.toLowerCase() === 'surat') return 1;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [features, customAreas]);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: prev[group] === false ? true : false }));
  };

  const filteredPolygons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return polygons;
    return polygons.filter(p => {
      const formattedName = formatProjectDisplayName(p).toLowerCase();
      const rawName = (p.data?.name || '').toLowerCase();
      const proj = (p.data?.project || '').toLowerCase();
      return formattedName.includes(query) || rawName.includes(query) || proj.includes(query);
    });
  }, [polygons, searchQuery]);

  const filteredLandmarks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return landmarksList;
    return landmarksList.filter(l => {
      return l.title.toLowerCase().includes(query) || l.location.toLowerCase().includes(query);
    });
  }, [landmarksList, searchQuery]);

  const filteredAreas = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return parentLocationsList;
    return parentLocationsList.filter(a => {
      const matchName = a.name.toLowerCase().includes(query);
      const matchSub = (a.subLocations || []).some(s => s.toLowerCase().includes(query));
      return matchName || matchSub;
    });
  }, [parentLocationsList, searchQuery]);

  // Flatten for virtualization
  const virtualRows = useMemo(() => {
    const rows = [];
    const groups = {};

    if (activeTab === 'projects') {
      filteredPolygons.forEach(p => {
        let groupName = p.data?.project;
        if (!groupName || groupName === 'Default') {
          if (filterSecondary) {
            groupName = filterSecondary;
          } else if (filterPrimary) {
            groupName = filterPrimary;
          } else {
            groupName = p.data?.parentLocation || p.data?.parent_location || determineParentLocation(p.data?.location);
          }
        }

        if (!groupName || groupName === 'Other Locations' || groupName === 'Other') {
          return;
        }

        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push({ itemType: 'project', feature: p });
      });

      Object.keys(groups).sort().forEach(groupName => {
        const isExpanded = expandedGroups[groupName] !== false;
        rows.push({ type: 'header', groupName, count: groups[groupName].length, isExpanded });
        if (isExpanded) {
          groups[groupName].forEach(item => rows.push({ type: 'item', ...item }));
        }
      });
    } else if (activeTab === 'landmarks') {
      filteredLandmarks.forEach(l => {
        const groupName = l.parentLocation || determineParentLocation(l.location) || 'Surat';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push({ itemType: 'landmark', landmark: l, feature: l.feature });
      });

      Object.keys(groups).sort().forEach(groupName => {
        const isExpanded = expandedGroups[groupName] !== false;
        rows.push({ type: 'header', groupName, count: groups[groupName].length, isExpanded });
        if (isExpanded) {
          groups[groupName].forEach(item => rows.push({ type: 'item', ...item }));
        }
      });
    } else if (activeTab === 'areas') {
      filteredAreas.forEach(area => {
        rows.push({ type: 'item', itemType: 'area', area });
      });
    }

    return rows;
  }, [activeTab, filteredPolygons, filteredLandmarks, filteredAreas, expandedGroups, filterPrimary, filterSecondary]);

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const parentRef = useRef(null);

  const getItemSize = useCallback((index) => {
    const row = virtualRows[index];
    if (!row) return 50;
    if (row.type === 'header') return 44;
    if (row.itemType === 'area') return 68;
    return 66;
  }, [virtualRows]);

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getItemSize,
    overscan: 5,
  });

  return (
    <>
    <div style={sidebarStyle} className={`slide-in-left responsive-sidebar projects-panel-container ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* Header Panel */}
      <div style={{ padding: '14px 14px', borderBottom: `1px solid ${borderColor}`, background: headerBg, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Karma Realtors Brand Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingBottom: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <img
            src="https://karmagroup.co.in/images/Karma%20logo%20R%20PNG%20(1)%20(1).png"
            alt="Karma Realtors Logo"
            style={{ height: 38, maxWidth: 220, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(245, 158, 11, 0.25))' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {appMode === 'edit' && (
              <>
                {/* 
                <button
                  onClick={async () => {
                    const state = useMapStore.getState();
                    if (!state.googleSheetsConnected) {
                      const { requestLogin } = await import('../services/googleSheets');
                      requestLogin();
                      return;
                    }
                    if (!confirm('Are you sure you want to fix all locations and overwrite the Google Sheet?')) return;
                    try {
                      const { features, customAreas, spreadsheetId } = state;
                      const { CATEGORY_MAP, determineParentLocation } = await import('../config/categories');
                      const { overwriteSheetWithFeatures } = await import('../services/googleSheets');
                      
                      const allParentLocations = Array.from(new Set([...Object.keys(CATEGORY_MAP), ...customAreas]));
                      
                      const fixedFeatures = features.map(f => {
                        let loc = f.data?.location || '';
                        let pLoc = f.data?.parentLocation || f.data?.parent_location;
                        if (pLoc && !allParentLocations.includes(pLoc)) {
                          if (!loc || loc === pLoc) loc = pLoc;
                          else loc = `${pLoc}, ${loc}`;
                          pLoc = 'Surat';
                        } else if (!pLoc) {
                          pLoc = determineParentLocation(loc);
                        }
                        return { ...f, data: { ...f.data, parentLocation: pLoc, parent_location: pLoc, location: loc } };
                      });
                      
                      useMapStore.setState({ features: fixedFeatures });
                      await overwriteSheetWithFeatures(spreadsheetId, fixedFeatures, 'Polygons');
                      alert('Done! Successfully fixed locations and overwrote Polygons sheet.');
                    } catch (e) {
                      console.error(e);
                      alert('Error: ' + e.message);
                    }
                  }}
                  style={{
                    padding: '6px 12px', background: '#ef4444', color: 'white', 
                    borderRadius: 8, fontSize: 12, border: 'none', cursor: 'pointer',
                    fontWeight: 'bold', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  Fix DB
                </button>
                */}
                <a
                  href={`https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_GOOGLE_SHEET_ID}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  title="Open Google Sheet"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#10b981', cursor: 'pointer', transition: 'transform 0.2s',
                    background: 'rgba(16, 185, 129, 0.1)', padding: 6, borderRadius: '50%',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                <FaFileExcel size={16} />
              </a>
              </>
            )}
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#f59e0b',
              background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.4)',
              padding: '3px 9px', borderRadius: 12, letterSpacing: '0.5px', textTransform: 'uppercase'
            }}>
              Map Editor
            </span>
            {isMobileOpen && (
              <button 
                onClick={() => setIsMobileOpen(false)}
                style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', 
                  color: '#94a3b8', cursor: 'pointer', padding: 6, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}
              >
                <FiX size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Desktop Navigation Tabs Bar (Horizontal) */}
        <div className="desktop-tabs-wrapper" style={{
          position: 'relative',
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: 2,
          gap: 4
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className="btn-hover-effect"
            style={{
              flex: 1, padding: '7px 0', border: 'none',
              borderBottom: activeTab === 'projects' ? '2.5px solid #f59e0b' : '2.5px solid transparent',
              fontSize: 12, fontWeight: activeTab === 'projects' ? 700 : 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              background: 'transparent',
              color: activeTab === 'projects' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.2s ease'
            }}
          >
            <FiLayers size={13} color={activeTab === 'projects' ? '#f59e0b' : '#94a3b8'} />
            Projects
            <span style={{
              fontSize: 9.5, fontWeight: 600,
              color: activeTab === 'projects' ? '#fde68a' : 'rgba(255, 255, 255, 0.5)',
              background: activeTab === 'projects' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.08)',
              border: activeTab === 'projects' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.12)',
              padding: '1px 5px', borderRadius: 8, fontVariantNumeric: 'tabular-nums'
            }}>
              {polygons.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('landmarks')}
            className="btn-hover-effect"
            style={{
              flex: 1, padding: '7px 0', border: 'none',
              borderBottom: activeTab === 'landmarks' ? '2.5px solid #f59e0b' : '2.5px solid transparent',
              fontSize: 12, fontWeight: activeTab === 'landmarks' ? 700 : 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              background: 'transparent',
              color: activeTab === 'landmarks' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.2s ease'
            }}
          >
            <FiMapPin size={13} color={activeTab === 'landmarks' ? '#f59e0b' : '#94a3b8'} />
            Landmarks
            <span style={{
              fontSize: 9.5, fontWeight: 600,
              color: activeTab === 'landmarks' ? '#fde68a' : 'rgba(255, 255, 255, 0.5)',
              background: activeTab === 'landmarks' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.08)',
              border: activeTab === 'landmarks' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.12)',
              padding: '1px 5px', borderRadius: 8, fontVariantNumeric: 'tabular-nums'
            }}>
              {landmarksList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('areas')}
            className="btn-hover-effect"
            style={{
              flex: 1, padding: '7px 0', border: 'none',
              borderBottom: activeTab === 'areas' ? '2.5px solid #f59e0b' : '2.5px solid transparent',
              fontSize: 12, fontWeight: activeTab === 'areas' ? 700 : 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              background: 'transparent',
              color: activeTab === 'areas' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.2s ease'
            }}
          >
            <FiGlobe size={13} color={activeTab === 'areas' ? '#f59e0b' : '#94a3b8'} />
            Area
            <span style={{
              fontSize: 9.5, fontWeight: 600,
              color: activeTab === 'areas' ? '#fde68a' : 'rgba(255, 255, 255, 0.5)',
              background: activeTab === 'areas' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.08)',
              border: activeTab === 'areas' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.12)',
              padding: '1px 5px', borderRadius: 8, fontVariantNumeric: 'tabular-nums'
            }}>
              {parentLocationsList.length}
            </span>
          </button>
        </div>

        {/* Desktop Action Buttons */}
        <div className="desktop-tabs-wrapper" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {activeTab === 'projects' ? (
            appMode === 'edit' && (
              <button
                type="button"
                onClick={onAddProject}
                className="btn-hover-effect"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 0', background: '#f59e0b', color: '#000000', border: 'none',
                  borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)', transition: 'all 0.2s'
                }}
              >
                <FiPlus size={14} color="#000000" /> Add Project
              </button>
            )
          ) : activeTab === 'landmarks' ? (
            appMode === 'edit' && (
              <button
                type="button"
                onClick={onAddLandmark}
                className="btn-hover-effect"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 0', background: 'linear-gradient(135deg, #475569 0%, #334155 100%)', color: '#fff', border: '1px solid #64748b',
                  borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(71, 85, 105, 0.35)', transition: 'all 0.2s'
                }}
              >
                <FiMapPin size={14} /> Add Landmark
              </button>
            )
          ) : (
            appMode === 'edit' && (
              <button
                type="button"
                onClick={() => setIsAddingArea(true)}
                className="btn-hover-effect"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 0', background: '#f59e0b', color: '#000000', border: 'none',
                  borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)', transition: 'all 0.2s'
                }}
              >
                <FiPlus size={14} color="#000000" /> Add Area
              </button>
            )
          )}
        </div>

        {/* Navigation Tabs Bar (Hamburger Dropdown Style for Landscape Mobile) */}
        <div className="landscape-hamburger-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center', paddingBottom: 8, gap: 12 }}>
          <button
            type="button"
            onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 8,
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#f8fafc',
              transition: 'all 0.2s ease'
            }}
          >
            <FiMenu size={18} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeTab === 'projects' && (
              <>
                <FiLayers size={15} color="#f59e0b" />
                <span style={{ fontSize: 14.5, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.3px' }}>Projects</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fde68a', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 7px', borderRadius: 10 }}>{polygons.length}</span>
              </>
            )}
            {activeTab === 'landmarks' && (
              <>
                <FiMapPin size={15} color="#f59e0b" />
                <span style={{ fontSize: 14.5, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.3px' }}>Landmarks</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fde68a', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 7px', borderRadius: 10 }}>{landmarksList.length}</span>
              </>
            )}
            {activeTab === 'areas' && (
              <>
                <FiGlobe size={15} color="#f59e0b" />
                <span style={{ fontSize: 14.5, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.3px' }}>Areas</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fde68a', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 7px', borderRadius: 10 }}>{parentLocationsList.length}</span>
              </>
            )}
          </div>
          
          {/* Dynamic Action Button beside tab */}
          <div style={{ marginLeft: 'auto', display: 'flex' }}>
            {activeTab === 'projects' && appMode === 'edit' && (
              <button
                type="button"
                onClick={onAddProject}
                className="btn-hover-effect"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 12px', background: '#f59e0b', color: '#000000', border: 'none',
                  borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)', transition: 'all 0.2s'
                }}
              >
                <FiPlus size={13} color="#000000" /> <span className="desktop-only-text">Add</span>
              </button>
            )}
            {activeTab === 'landmarks' && appMode === 'edit' && (
              <button
                type="button"
                onClick={onAddLandmark}
                className="btn-hover-effect"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 12px', background: 'linear-gradient(135deg, #475569 0%, #334155 100%)', color: '#fff', border: '1px solid #64748b',
                  borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(71, 85, 105, 0.35)', transition: 'all 0.2s'
                }}
              >
                <FiPlus size={13} /> <span className="desktop-only-text">Add</span>
              </button>
            )}
            {activeTab === 'areas' && appMode === 'edit' && (
              <button
                type="button"
                onClick={() => setIsAddingArea(true)}
                className="btn-hover-effect"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 12px', background: '#f59e0b', color: '#000000', border: 'none',
                  borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)', transition: 'all 0.2s'
                }}
              >
                <FiPlus size={13} color="#000000" /> <span className="desktop-only-text">Add</span>
              </button>
            )}
          </div>

          {isTabDropdownOpen && (
             <div 
               className="slide-in-up"
               style={{
                  position: 'absolute', top: 40, left: 0, width: 220,
                  background: 'rgba(15, 23, 42, 0.98)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 12, padding: 8, zIndex: 1100,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.7)',
                  display: 'flex', flexDirection: 'column', gap: 4
             }}>
                <button
                  onClick={() => { setActiveTab('projects'); setIsTabDropdownOpen(false); }}
                  className="btn-hover-effect"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    background: activeTab === 'projects' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    color: activeTab === 'projects' ? '#f8fafc' : '#94a3b8'
                  }}
                >
                  <FiLayers size={15} color={activeTab === 'projects' ? '#f59e0b' : '#94a3b8'} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: activeTab === 'projects' ? 700 : 500 }}>Projects</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: activeTab === 'projects' ? '#fde68a' : '#64748b', background: activeTab === 'projects' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 8 }}>{polygons.length}</span>
                </button>

                <button
                  onClick={() => { setActiveTab('landmarks'); setIsTabDropdownOpen(false); }}
                  className="btn-hover-effect"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    background: activeTab === 'landmarks' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    color: activeTab === 'landmarks' ? '#f8fafc' : '#94a3b8'
                  }}
                >
                  <FiMapPin size={15} color={activeTab === 'landmarks' ? '#f59e0b' : '#94a3b8'} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: activeTab === 'landmarks' ? 700 : 500 }}>Landmarks</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: activeTab === 'landmarks' ? '#fde68a' : '#64748b', background: activeTab === 'landmarks' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 8 }}>{landmarksList.length}</span>
                </button>

                <button
                  onClick={() => { setActiveTab('areas'); setIsTabDropdownOpen(false); }}
                  className="btn-hover-effect"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    background: activeTab === 'areas' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    color: activeTab === 'areas' ? '#f8fafc' : '#94a3b8'
                  }}
                >
                  <FiGlobe size={15} color={activeTab === 'areas' ? '#f59e0b' : '#94a3b8'} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: activeTab === 'areas' ? 700 : 500 }}>Areas</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: activeTab === 'areas' ? '#fde68a' : '#64748b', background: activeTab === 'areas' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 8 }}>{parentLocationsList.length}</span>
                </button>
             </div>
          )}
        </div>

                

        {/* Search Bar Input */}
        <div style={{ position: 'relative' }}>
          <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(245, 158, 11, 0.75)' }} size={14} />
          <input
            type="text"
            placeholder={activeTab === 'projects' ? "Search projects..." : activeTab === 'landmarks' ? "Search landmarks..." : "Search areas..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input-styled"
            style={{
              width: '100%', padding: '8.5px 30px 8.5px 32px', borderRadius: 10,
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.18)' : '#cbd5e1'}`, fontSize: 12.5, boxSizing: 'border-box',
              outline: 'none', transition: 'all 0.2s', background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#fff', color: isDark ? '#f8fafc' : '#0f172a',
              boxShadow: 'inset 0 1.5px 3px rgba(0, 0, 0, 0.4)'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex'
              }}
            >
              <FiX size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Items List Container */}
      <div
        ref={parentRef}
        className="projects-list-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}
      >
        {virtualRows.length === 0 ? (
          <div style={{ padding: '24px 16px', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
            {activeTab === 'projects' ? 'No projects found.' : 'No landmarks found.'}
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = virtualRows[virtualRow.index];
              if (!row) return null;

              if (row.type === 'header') {
                return (
                  <div
                    key={`header-${row.groupName}`}
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      padding: '4px 10px 2px 10px'
                    }}
                  >
                    <div
                      onClick={() => toggleGroup(row.groupName)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 12px', borderRadius: 8,
                        background: row.isExpanded
                          ? (isDark ? 'rgba(15, 23, 42, 0.50)' : '#f1f5f9')
                          : 'transparent',
                        border: row.isExpanded
                          ? '1px solid rgba(245, 158, 11, 0.25)'
                          : '1px solid transparent',
                        cursor: 'pointer', userSelect: 'none', transition: 'all 0.2s ease',
                        height: '100%', boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 20, height: 20, borderRadius: 6,
                          background: row.isExpanded ? 'rgba(245, 158, 11, 0.18)' : 'rgba(148, 163, 184, 0.15)',
                          color: row.isExpanded ? '#f59e0b' : '#94a3b8', flexShrink: 0
                        }}>
                          {row.isExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                        </div>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: isDark ? '#ffffff' : '#0f172a',
                          letterSpacing: '0.2px',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {row.groupName}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: '#f59e0b',
                        background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)',
                        padding: '1px 7px', borderRadius: 10, flexShrink: 0, fontVariantNumeric: 'tabular-nums'
                      }}>
                        {row.count}
                      </span>
                    </div>
                  </div>
                );
              }

              // Landmark Card Rendering
              if (row.itemType === 'landmark') {
                const isSelected = selectedFeatureId === row.feature.id;
                return (
                  <div
                    key={`landmark-${row.landmark.id}`}
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      padding: '3px 14px 3px 16px'
                    }}
                  >
                    <div
                      onClick={async () => {
                        const isDedicatedLandmarkPin = row.feature?.id?.startsWith('landmark-') || row.feature?.data?.type === 'Landmark';

                        if (isDedicatedLandmarkPin) {
                          setSelectedFeatureId(row.feature.id);
                          setIsInfoPanelOpen(true);
                          if (map && row.feature?.position) {
                            map.panTo(row.feature.position);
                            map.setZoom(17);
                          }
                        } else {
                          // Property Landmark -> open parent polygon
                          if (row.feature && row.feature.id) {
                            setSelectedFeatureId(row.feature.id);
                            setIsInfoPanelOpen(true);
                            if (map) {
                              const pos = await resolveLandmarkLocation(row.landmark.title, row.feature?.center || row.feature?.position);
                              if (pos) {
                                map.panTo(pos);
                                map.setZoom(17);
                              } else {
                                zoomToProperty(map, row.feature);
                              }
                            }
                          }
                        }
                      }}
                      title={row.landmark.title}
                      className="project-card-interactive"
                      style={{
                        position: 'relative',
                        height: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: isSelected
                          ? (isDark ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.20) 0%, rgba(217, 119, 6, 0.12) 100%)' : '#fffbe6')
                          : (isDark ? 'rgba(30, 41, 59, 0.65)' : '#ffffff'),
                        border: isSelected
                          ? '1.5px solid #f59e0b'
                          : (isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0'),
                        boxShadow: isSelected ? '0 4px 14px rgba(245, 158, 11, 0.25)' : (isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 6px rgba(0, 0, 0, 0.05)'),
                        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 24, height: 24, borderRadius: 6,
                          background: isSelected ? 'rgba(245, 158, 11, 0.25)' : 'rgba(148, 163, 184, 0.15)',
                          color: isSelected ? '#f59e0b' : '#94a3b8', flexShrink: 0
                        }}>
                          <FiMapPin size={13} />
                        </div>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: isSelected ? '#f59e0b' : (isDark ? '#e2e8f0' : '#1e293b'),
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {row.landmark.title}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: isSelected ? '#f59e0b' : '#94a3b8',
                        background: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                        padding: '2px 6px', borderRadius: 6, flexShrink: 0,
                        whiteSpace: 'nowrap'
                      }}>
                        {row.landmark.location}
                      </span>
                    </div>
                  </div>
                );
              }

              // Area Card Rendering
              if (row.itemType === 'area') {
                const isSelected = filterPrimary?.toLowerCase() === row.area.name.toLowerCase();
                const subLocsText = (row.area.subLocations && row.area.subLocations.length > 0)
                  ? row.area.subLocations.join(', ')
                  : `All plots in ${row.area.name}`;

                return (
                  <div
                    key={`area-${row.area.name}`}
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      padding: '3px 14px 3px 16px'
                    }}
                  >
                    <div
                      onClick={() => {
                        if (isSelected) {
                          setFilterPrimary(null);
                          setSelectedAreaName(null);
                        } else {
                          setFilterPrimary(row.area.name);
                          setSelectedAreaName(row.area.name);
                          if (map && row.area.features.length > 0) {
                            fitAllBounds(map, row.area.features);
                          }
                        }
                      }}
                      title={`Click to filter map by ${row.area.name}`}
                      className="project-card-interactive"
                      style={{
                        position: 'relative',
                        height: '100%',
                        padding: '10px 14px 10px 16px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        background: isSelected
                          ? (isDark ? 'linear-gradient(145deg, rgba(245, 158, 11, 0.16) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'linear-gradient(145deg, #fffbe6, #ffffff)')
                          : (isDark ? 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.4))' : '#ffffff'),
                        border: isSelected
                          ? '1px solid rgba(245, 158, 11, 0.5)'
                          : (isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(226, 232, 240, 0.8)'),
                        boxShadow: isSelected 
                          ? (isDark ? '0 8px 24px -4px rgba(245, 158, 11, 0.25)' : '0 8px 24px -4px rgba(245, 158, 11, 0.15)') 
                          : (isDark ? '0 4px 12px rgba(0, 0, 0, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.04)'),
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: 4,
                        boxSizing: 'border-box'
                      }}
                    >
                      <div className="card-accent-stripe" style={{
                        position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 4,
                        borderRadius: '0 4px 4px 0',
                        background: 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)',
                        opacity: isSelected ? 1 : 0.4,
                        boxShadow: isSelected ? '0 0 8px rgba(245, 158, 11, 0.6)' : 'none',
                        transition: 'all 0.2s ease'
                      }} />

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                          <div style={{ 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 22, height: 22, borderRadius: 6,
                            background: isSelected ? 'rgba(245, 158, 11, 0.2)' : (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.04)'),
                            color: isSelected ? '#f59e0b' : '#94a3b8'
                          }}>
                            <FiGlobe size={12} strokeWidth={2.5} />
                          </div>
                          <span style={{
                            fontSize: 13, fontWeight: 700, letterSpacing: '0.2px',
                            color: isSelected ? '#f59e0b' : (isDark ? '#f8fafc' : '#0f172a'),
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>
                            {row.area.name}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: isSelected ? '#f59e0b' : (isDark ? '#d9a74a' : '#b45309'),
                          background: isSelected ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.10)',
                          border: isSelected ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(245, 158, 11, 0.25)',
                          padding: '2px 8px', borderRadius: 8, flexShrink: 0,
                          whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'
                        }}>
                          {row.area.count} {row.area.count === 1 ? 'plot' : 'plots'}
                        </span>
                      </div>

                      <div style={{
                        fontSize: 11, fontWeight: 400, opacity: 0.7,
                        color: isDark ? '#94a3b8' : '#64748b',
                        display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        marginTop: 1,
                        paddingLeft: 32
                      }}>
                        {subLocsText}
                      </div>
                    </div>
                  </div>
                );
              }

              // Project Card Rendering
              const isSelected = selectedFeatureId === row.feature.id;
              const parts = getProjectDisplayParts(row.feature);
              const typeColor = getPropertyTypeColor(row.feature?.data?.type);

              return (
                <div
                  key={`item-${row.feature.id}`}
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    padding: '3px 14px 3px 16px'
                  }}
                >
                  <div
                    onClick={() => {
                      const state = useMapStore.getState();
                      if (state.isInfoPanelOpen && state.selectedFeatureId !== row.feature.id) {
                        setIsInfoPanelOpen(false);
                        setTimeout(() => {
                          setSelectedFeatureId(row.feature.id);
                          setIsInfoPanelOpen(true);
                          if (map) zoomToProperty(map, row.feature);
                        }, 250);
                      } else {
                        setSelectedFeatureId(row.feature.id);
                        setIsInfoPanelOpen(true);
                        if (map) zoomToProperty(map, row.feature);
                      }
                    }}
                    title={formatProjectDisplayName(row.feature)}
                    className="project-card-interactive"
                    style={{
                      position: 'relative',
                      height: '100%',
                      padding: '9px 12px 9px 14px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: isSelected
                        ? (isDark ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.20) 0%, rgba(217, 119, 6, 0.12) 100%)' : '#fffbe6')
                        : (isDark ? 'rgba(30, 41, 59, 0.65)' : '#ffffff'),
                      border: isSelected
                        ? '1.5px solid #f59e0b'
                        : (isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0'),
                      boxShadow: isSelected ? '0 4px 14px rgba(245, 158, 11, 0.25)' : (isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 6px rgba(0, 0, 0, 0.05)'),
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 3,
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Color Accent Stripe (55% Opacity on Inactive, 100% on Active) */}
                    <div
                      className="card-accent-stripe"
                      style={{
                        position: 'absolute', left: 4, top: 8, bottom: 8, width: 3.5,
                        borderRadius: 4, background: isSelected ? '#f59e0b' : (typeColor || '#d9a74a'),
                        opacity: isSelected ? 1 : 0.55,
                        transition: 'all 0.18s ease'
                      }}
                    />

                    {/* Line 1: Location & Area */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 0 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: isSelected ? '#f59e0b' : (isDark ? '#e2e8f0' : '#1e293b'),
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        flex: 1, minWidth: 0
                      }}>
                        {parts.locationTitle}
                      </span>
                      {parts.areaTitle && parts.areaTitle !== '_' && (
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: isSelected ? '#f59e0b' : '#d9a74a',
                          background: isSelected ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.10)',
                          border: isSelected ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(245, 158, 11, 0.25)',
                          padding: '2px 7px', borderRadius: 6, flexShrink: 0,
                          whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'
                        }}>
                          {parts.areaTitle}
                        </span>
                      )}
                    </div>

                    {/* Line 2: TP OP FP Metadata */}
                    <div style={{
                      fontSize: 10.5, fontWeight: 400, opacity: 0.65,
                      color: 'rgba(255, 255, 255, 0.65)',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      marginTop: 3, lineHeight: 1.4
                    }}>
                      {parts.tpOpFpTitle}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAddingArea && (
        <AddAreaModal
          onClose={() => setIsAddingArea(false)}
        />
      )}

    </div>

    {/* MOBILE BACKDROP */}
    {isMobileOpen && (
      <div 
        className="mobile-projects-backdrop"
        onClick={() => setIsMobileOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 2199,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)'
        }}
      />
    )}

    {/* MOBILE NOTCH */}
    <div 
      className="mobile-projects-dock-bar"
      onClick={() => setIsMobileOpen(true)}
    >
      <span style={{ fontSize: 14.5, fontWeight: 700, color: '#f8fafc' }}>
        dropdown of sidebar
      </span>
    </div>
  </>
  );
}
