import { useState, useMemo, useRef, useCallback } from 'react';
import { FiSearch, FiPlus, FiChevronDown, FiChevronRight, FiMapPin, FiX, FiLayers, FiGlobe, FiMenu, FiClock, FiUsers, FiMove, FiTrash2 } from 'react-icons/fi';
import { FaFileExcel } from 'react-icons/fa';
import { useMapStore } from '../store/useMapStore';
import { CATEGORY_MAP, determineParentLocation, getPropertyTypeColor, buildDynamicLocationMap } from '../config/categories';
import { useVirtualizer } from '@tanstack/react-virtual';
import GoogleSheetsConnect from './GoogleSheetsConnect';
import AddAreaModal from './AddAreaModal';
import { useGoogleMap } from '../context/GoogleMapContext';
import { zoomToProperty, fitAllBounds } from '../services/googleMaps';
import { syncFeatureToSheet } from '../services/googleSheets';
import toast from 'react-hot-toast';
import { cleanLandmarkTitle, resolveLandmarkLocation } from './LandmarkManager';
import PendingSubmissionsPanel from './PendingSubmissionsPanel';
import UsersPanel from './UsersPanel';

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
  const dynamicLocationMap = useMemo(() => buildDynamicLocationMap(features), [features]);
  const selectedFeatureId = useMapStore(state => state.selectedFeatureId);
  //   const selectedAreaName = useMapStore(state => state.selectedAreaName);
  const setSelectedFeatureId = useMapStore(state => state.setSelectedFeatureId);
  const setSelectedAreaName = useMapStore(state => state.setSelectedAreaName);
  const setIsInfoPanelOpen = useMapStore(state => state.setIsInfoPanelOpen);
  const theme = useMapStore(state => state.theme);
  //   const googleAccessToken = useMapStore(state => state.googleAccessToken);
  const map = useGoogleMap();

  const isDark = theme === 'dark';

  // Dynamic Sidebar Glassmorphic Design
  const sidebarStyle = {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 1000,
    // Widened from 380 so the 4-tab row (icon + label + count badge, x4, plus divider
    // lines) has enough room to lay out without any tab's icon/text getting squeezed
    // and clipped by the panel's own overflow:hidden.
    width: 420,
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
  const customAreas = useMapStore(state => state.customAreas) || [];
  const setFilterPrimary = useMapStore(state => state.setFilterPrimary);
  const setFilterSecondary = useMapStore(state => state.setFilterSecondary);
  const renameArea = useMapStore(state => state.renameArea);
  const deleteArea = useMapStore(state => state.deleteArea);
  const deleteSubLocation = useMapStore(state => state.deleteSubLocation);
  const mergeAreaIntoPrimary = useMapStore(state => state.mergeAreaIntoPrimary);
  const moveSubArea = useMapStore(state => state.moveSubArea);
  const promoteSubToPrimary = useMapStore(state => state.promoteSubToPrimary);
  const spreadsheetId = useMapStore(state => state.spreadsheetId);
  const [isAddingArea, setIsAddingArea] = useState(false);

  // Sub-area accordion (Areas tab): which Primary Areas currently have their
  // Sub-area list expanded inline, exactly like the approved design mockup —
  // { [primaryName]: true }. Row height for an expanded card is computed in
  // getItemSize below, since @tanstack/react-virtual supports a per-row size fn.
  const [expandedPrimaries, setExpandedPrimaries] = useState({});
  const [editingSubarea, setEditingSubarea] = useState(null); // { oldName, value } | null
  const [editingPrimary, setEditingPrimary] = useState(null); // { oldName, value } | null

  // Move panel: a small floating dropdown ("Move into…") anchored to whichever
  // Move icon was clicked, for a Primary Area or a Sub-area.
  const [movePanel, setMovePanel] = useState(null); // { isSub, name, parentName, rect, target } | null
  // Delete confirm: same floating-anchor pattern, staged — nothing deletes until
  // "Confirm Delete" is actually clicked, and plots are always rescued into
  // Unassigned rather than lost.
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { isSub, name, parentName, rect } | null

  // Show all visible features in the panel, filtered by global map filters
  const polygons = useMemo(() => {
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

      if (isVisible && (filterPrimary || filterSecondary)) {
        const loc = feature.data?.location;
        if (filterSecondary) {
          if (loc !== filterSecondary) isVisible = false;
        } else if (filterPrimary) {
          const validLocations = [filterPrimary, ...(dynamicLocationMap[filterPrimary] || [])];
          if (!validLocations.includes(loc)) isVisible = false;
        }
      }

      if (isVisible && filterType) {
        if (feature.data?.type !== filterType) isVisible = false;
      }

      return isVisible && feature.style?.visible !== false;
    });
  }, [features, filterPrimary, filterSecondary, filterType, dynamicLocationMap]);

  // Extract unique landmarks for the Landmarks tab
  const landmarksList = useMemo(() => {
    const seen = new Set();
    const list = [];

    features.forEach(f => {
      const isLandmarkType = f.data?.type === 'Landmark' || f.id?.startsWith('landmark-');
      if (!isLandmarkType) return;

      if (f.style?.visible === false) return;

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
  }, [features]);

  // Extract all Parent Locations for the Area tab
  const parentLocationsList = useMemo(() => {
    const parentMap = new Map();

    // 1. Defaults from CATEGORY_MAP (known parent categories, even with 0 plots so far)
    Object.keys(CATEGORY_MAP).forEach(parent => {
      parentMap.set(parent, {
        name: parent,
        subLocations: dynamicLocationMap[parent] || [],
        features: []
      });
    });

    // 2. Custom areas from store
    customAreas.forEach(parent => {
      if (!parentMap.has(parent)) {
        parentMap.set(parent, {
          name: parent,
          subLocations: dynamicLocationMap[parent] || [],
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
            subLocations: dynamicLocationMap[parentLoc] || [],
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
      // Unassigned (rescued plots waiting to be re-homed) always sorts last.
      const aUnassigned = a.name.toLowerCase() === 'unassigned';
      const bUnassigned = b.name.toLowerCase() === 'unassigned';
      if (aUnassigned && !bUnassigned) return 1;
      if (bUnassigned && !aUnassigned) return -1;
      if (a.name.toLowerCase() === 'surat') return -1;
      if (b.name.toLowerCase() === 'surat') return 1;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [features, customAreas, dynamicLocationMap]);

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
      // Flat list — landmarks span many different cities/locations, not sub-areas of a
      // single parent, so grouping them under a "Surat (N)" style header was misleading.
      filteredLandmarks.forEach(l => {
        rows.push({ type: 'item', itemType: 'landmark', landmark: l, feature: l.feature });
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

  // Generous, hand-tuned pixel budgets for the Areas tab's virtualized rows — the
  // virtualizer needs an exact height up front per row, so getting these too small
  // clips content (as happened with the warning line above); a little extra blank
  // space below a card is far less visible than the next card overlapping it, so
  // these lean generous on purpose.
  // +6 over the old values on these three — matches the wrapper's own top+bottom
  // padding going from 3px/3px to 6px/6px, so consecutive Primary cards get real
  // breathing room between them instead of touching (Surat's sub-areas line was
  // butting directly against the next card, e.g. "Aat").
  const AREA_ROW_BASE = 74;           // Primary card, no sub-areas
  const AREA_ROW_WITH_SUBS_COLLAPSED = 106; // + warning line + "N sub-areas: …" trigger row
  const AREA_ROW_HEADER_ONLY = 84;    // header + warning line, no trigger/accordion below it
  // Sub-area rows no longer expand to show a plot list (the Projects tab already
  // covers every plot — showing them again here was redundant and was the actual
  // source of the clipping/overlap bugs), so each one is just a flat, roomier row:
  // pin + name + Move/Delete + plot-count chip, ~46px including its own padding.
  const AREA_SUB_ROW = 46;
  const AREA_ACCORDION_PADDING = 10;

  const getItemSize = useCallback((index) => {
    const row = virtualRows[index];
    if (!row) return 50;
    if (row.type === 'header') return 44;
    if (row.itemType === 'area') {
      const hasSubs = row.area.subLocations && row.area.subLocations.length > 0;
      if (!hasSubs) return AREA_ROW_BASE;
      const isExpanded = !!expandedPrimaries[row.area.name];
      if (!isExpanded) return AREA_ROW_WITH_SUBS_COLLAPSED;
      return AREA_ROW_HEADER_ONLY + (row.area.subLocations.length * AREA_SUB_ROW) + AREA_ACCORDION_PADDING;
    }
    return 66;
  }, [virtualRows, expandedPrimaries]);

  // Area rows no longer rely on hand-computed pixel budgets to avoid clipping or
  // overlap (three rounds of that game were enough — every fix for one screenshot
  // broke another). getItemSize below is now only the INITIAL guess used before a
  // row has been painted; each row's DOM node is measured for real via
  // rowVirtualizer.measureElement (a ResizeObserver ref, attached to every row
  // wrapper further down), so the virtualizer self-corrects to whatever the actual
  // rendered height is — including every future edge case, not just the ones a
  // screenshot happened to catch.
  // Measured heights are cached by key, not by row index — without a stable key,
  // switching tabs (Areas -> Landmarks etc) reuses the same index for completely
  // different content, so a row can silently inherit another tab's already-measured
  // height instead of its own (this is what broke the Landmarks tab's sizing after
  // the switch to real DOM measurement above).
  const getItemKey = useCallback((index) => {
    const row = virtualRows[index];
    if (!row) return index;
    if (row.type === 'header') return `header-${row.groupName}`;
    if (row.itemType === 'landmark') return `landmark-${row.landmark.id}`;
    if (row.itemType === 'area') return `area-${row.area.name}`;
    if (row.itemType === 'project') return `project-${row.feature.id}`;
    return index;
  }, [virtualRows]);

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getItemSize,
    getItemKey,
    overscan: 5,
  });

  return (
    <>
      <div style={sidebarStyle} className={`slide-in-left responsive-sidebar projects-panel-container ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Header Panel */}
        <div style={{ padding: '14px 14px', borderBottom: `1px solid ${borderColor}`, background: headerBg, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Karma Realtors Brand Header */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            paddingBottom: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <a
                href="http://karmagroup.co.in/Home/Index?Area=Surat&Latitude=21.1702&Longitude=72.8311"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', cursor: 'pointer', outline: 'none' }}
              >
                <img
                  src="https://karmagroup.co.in/images/Karma%20logo%20R%20PNG%20(1)%20(1).png"
                  alt="Karma Realtors Logo"
                  style={{ height: 38, maxWidth: 220, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(245, 158, 11, 0.25))' }}
                />
              </a>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {appMode === 'edit' && (
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
                )}
                {appMode === 'edit' && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('karmaAdminJWT');
                      useMapStore.getState().setIsAdminAuthenticated(false);
                    }}
                    title="Sign out of the admin editor"
                    style={{
                      fontSize: 10, fontWeight: 700, color: '#ef4444', cursor: 'pointer',
                      background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)',
                      padding: '3px 9px', borderRadius: 12, letterSpacing: '0.5px', textTransform: 'uppercase'
                    }}
                  >
                    Sign Out
                  </button>
                )}
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

            {/* Map Editor button: sits directly beneath the logo */}
            {appMode === 'edit' && (
              <span style={{
                alignSelf: 'flex-start',
                fontSize: 10, fontWeight: 700, color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.4)',
                padding: '3px 9px', borderRadius: 12, letterSpacing: '0.5px', textTransform: 'uppercase'
              }}>
                Map Editor
              </span>
            )}
          </div>

          {/* Desktop Navigation Tabs Bar (Horizontal) */}
          <div className="desktop-tabs-wrapper" style={{
            position: 'relative',
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: 2,
            // Small — the divider lines between tabs do the visual separation. This gap
            // applies between EVERY flex child including the dividers (7 children = 6 gaps),
            // so a larger value here was pushing the row past the sidebar's fixed width and
            // getting clipped by its overflow:hidden.
            gap: 2
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('projects')}
              className="btn-hover-effect"
              style={{
                flex: 1, minWidth: 0, overflow: 'hidden', padding: '7px 0', border: 'none',
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

            <div style={{ width: 1, alignSelf: 'stretch', marginBottom: 2, background: 'rgba(255, 255, 255, 0.12)', flexShrink: 0 }} />

            <button
              type="button"
              onClick={() => setActiveTab('landmarks')}
              className="btn-hover-effect"
              style={{
                flex: 1, minWidth: 0, overflow: 'hidden', padding: '7px 0', border: 'none',
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

            <div style={{ width: 1, alignSelf: 'stretch', marginBottom: 2, background: 'rgba(255, 255, 255, 0.12)', flexShrink: 0 }} />

            <button
              type="button"
              onClick={() => setActiveTab('areas')}
              className="btn-hover-effect"
              style={{
                flex: 1, minWidth: 0, overflow: 'hidden', padding: '7px 0', border: 'none',
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

            {appMode === 'edit' && (
              <>
                <div style={{ width: 1, alignSelf: 'stretch', marginBottom: 2, background: 'rgba(255, 255, 255, 0.12)', flexShrink: 0 }} />
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                className="btn-hover-effect"
                style={{
                  flex: 1, minWidth: 0, overflow: 'hidden', padding: '7px 0', border: 'none',
                  borderBottom: activeTab === 'users' ? '2.5px solid #f59e0b' : '2.5px solid transparent',
                  fontSize: 12, fontWeight: activeTab === 'users' ? 700 : 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  background: 'transparent',
                  color: activeTab === 'users' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.2s ease'
                }}
              >
                  <FiUsers size={13} color={activeTab === 'users' ? '#f59e0b' : '#94a3b8'} />
                  Users
                </button>
              </>
            )}
          </div>

          {/* Desktop Action Buttons */}
          <div className="desktop-tabs-wrapper" style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            {activeTab === 'projects' || activeTab === 'submissions' ? (
              <>
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
                  <FiPlus size={14} color="#000000" /> {appMode === 'edit' ? 'Add Project' : 'Add Polygon'}
                </button>

                {appMode === 'edit' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('submissions')}
                    className="btn-hover-effect"
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 0',
                      background: activeTab === 'submissions' ? '#10b981' : 'linear-gradient(135deg, #475569 0%, #334155 100%)',
                      color: '#fff', border: 'none',
                      borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(71, 85, 105, 0.35)', transition: 'all 0.2s'
                    }}
                  >
                    <FiClock size={14} color="#fff" /> Requests
                  </button>
                )}
              </>
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
            ) : activeTab === 'areas' && appMode === 'edit' ? (
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
            ) : null}
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
              {activeTab === 'submissions' && (
                <>
                  <FiClock size={15} color="#f59e0b" />
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.3px' }}>Requests</span>
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

                {appMode === 'edit' && (
                  <button
                    onClick={() => { setActiveTab('submissions'); setIsTabDropdownOpen(false); }}
                    className="btn-hover-effect"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      background: activeTab === 'submissions' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                      border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      color: activeTab === 'submissions' ? '#f8fafc' : '#94a3b8'
                    }}
                  >
                    <FiClock size={15} color={activeTab === 'submissions' ? '#f59e0b' : '#94a3b8'} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: activeTab === 'submissions' ? 700 : 500 }}>Requests</span>
                  </button>
                )}

                {appMode === 'edit' && (
                  <button
                    onClick={() => { setActiveTab('users'); setIsTabDropdownOpen(false); }}
                    className="btn-hover-effect"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      background: activeTab === 'users' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                      border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      color: activeTab === 'users' ? '#f8fafc' : '#94a3b8'
                    }}
                  >
                    <FiUsers size={15} color={activeTab === 'users' ? '#f59e0b' : '#94a3b8'} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: activeTab === 'users' ? 700 : 500 }}>Users</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Search Bar Input */}
          {activeTab !== 'submissions' && activeTab !== 'users' && (
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
          )}

          {/* Show/Hide all Sub-areas: toggles every Primary Area that has sub-areas
              open or closed at once, matching the approved design. */}
          {activeTab === 'areas' && parentLocationsList.some(a => a.subLocations && a.subLocations.length > 0) && (
            <button
              type="button"
              onClick={() => {
                const anyOpen = parentLocationsList.some(a => a.subLocations?.length > 0 && expandedPrimaries[a.name]);
                if (anyOpen) {
                  setExpandedPrimaries({});
                } else {
                  const all = {};
                  parentLocationsList.forEach(a => { if (a.subLocations && a.subLocations.length > 0) all[a.name] = true; });
                  setExpandedPrimaries(all);
                }
              }}
              className="btn-hover-effect"
              style={{
                width: '100%', marginTop: 8, padding: '9px 0', borderRadius: 999,
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.14)' : '#cbd5e1'}`,
                background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                color: isDark ? '#cbd5e1' : '#334155',
                fontSize: 12.5, fontWeight: 700, letterSpacing: '0.2px', cursor: 'pointer'
              }}
            >
              {parentLocationsList.some(a => a.subLocations?.length > 0 && expandedPrimaries[a.name])
                ? '▴ Hide all Sub-areas'
                : '▾ Show all Sub-areas'}
            </button>
          )}
        </div>

        {/* Items List Container */}
        <div
          ref={parentRef}
          className="projects-list-scroll"
          style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}
        >
          {activeTab === 'submissions' ? (
            <PendingSubmissionsPanel />
          ) : activeTab === 'users' ? (
            <UsersPanel />
          ) : virtualRows.length === 0 ? (
            <div style={{ padding: '24px 16px', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
              {activeTab === 'projects' ? 'No projects found.' : activeTab === 'landmarks' ? 'No landmarks found.' : 'No areas match your search.'}
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
                      ref={rowVirtualizer.measureElement}
                      data-index={virtualRow.index}
                      style={{
                        position: 'absolute',
                        top: 0, left: 0, width: '100%',
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
                          boxSizing: 'border-box'
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
                  const hasSubs = row.area.subLocations && row.area.subLocations.length > 0;
                  const subLocsText = hasSubs
                    ? row.area.subLocations.join(', ')
                    : `All plots in ${row.area.name}`;
                  const isExpanded = !!expandedPrimaries[row.area.name];

                  return (
                    <div
                      key={`area-${row.area.name}`}
                      ref={rowVirtualizer.measureElement}
                      data-index={virtualRow.index}
                      style={{
                        position: 'absolute',
                        top: 0, left: 0, width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        padding: '6px 14px 6px 16px'
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
                        style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
                      >
                        {/* HEAD BOX — the only bordered "card" part, matching the approved
                            design (Sub-areas below are a flat, unboxed continuation, not
                            nested inside another box). Sticky while its accordion is open,
                            so scrolling through a long Sub-area list (e.g. Surat's 18) keeps
                            this header in view above them, like the design mockup. */}
                        <div
                          className="project-card-interactive"
                          style={{
                            position: isExpanded ? 'sticky' : 'relative',
                            top: isExpanded ? 0 : 'auto',
                            zIndex: isExpanded ? 5 : 1,
                            flexShrink: 0,
                            padding: '10px 14px 10px 16px',
                            borderRadius: 12,
                            cursor: 'pointer',
                            background: isSelected
                              ? (isDark ? 'linear-gradient(145deg, rgba(245, 158, 11, 0.16) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'linear-gradient(145deg, #fffbe6, #ffffff)')
                              : (isDark ? 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.4))' : '#ffffff'),
                            border: isSelected
                              ? '1px solid rgba(245, 158, 11, 0.5)'
                              : (isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(226, 232, 240, 0.8)'),
                            boxShadow: isExpanded
                              ? '0 6px 16px rgba(0, 0, 0, 0.35)'
                              : (isSelected
                                ? (isDark ? '0 8px 24px -4px rgba(245, 158, 11, 0.25)' : '0 8px 24px -4px rgba(245, 158, 11, 0.15)')
                                : (isDark ? '0 4px 12px rgba(0, 0, 0, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.04)')),
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            flexDirection: 'column',
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
                              {editingPrimary?.oldName === row.area.name ? (
                                <input
                                  autoFocus
                                  value={editingPrimary.value}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setEditingPrimary(prev => ({ ...prev, value: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                    if (e.key === 'Escape') setEditingPrimary(null);
                                  }}
                                  onBlur={() => {
                                    const newName = editingPrimary.value.trim();
                                    if (newName && newName !== editingPrimary.oldName) {
                                      renameArea(editingPrimary.oldName, newName);
                                    }
                                    setEditingPrimary(null);
                                  }}
                                  style={{
                                    flex: 1, fontSize: 13, fontWeight: 700, padding: '3px 6px', borderRadius: 6,
                                    border: '1.5px solid rgba(245, 158, 11, 0.5)',
                                    background: isDark ? 'rgba(30, 41, 59, 0.9)' : '#fff',
                                    color: isDark ? '#f8fafc' : '#0f172a', outline: 'none', minWidth: 0
                                  }}
                                />
                              ) : (
                                <span
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditingPrimary({ oldName: row.area.name, value: row.area.name });
                                  }}
                                  title="Double-click to rename"
                                  style={{
                                    fontSize: 13, fontWeight: 700, letterSpacing: '0.2px',
                                    color: isSelected ? '#f59e0b' : (isDark ? '#f8fafc' : '#0f172a'),
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                  }}>
                                  {row.area.name}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              <button
                                type="button"
                                title={`Move "${row.area.name}" into another Primary Location`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setDeleteConfirm(null);
                                  setMovePanel(prev => (prev && !prev.isSub && prev.name === row.area.name ? null : {
                                    isSub: false, name: row.area.name, parentName: null, rect, target: ''
                                  }));
                                }}
                                className="btn-hover-effect"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '4px 9px', borderRadius: 999, flexShrink: 0,
                                  fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
                                  background: (movePanel && !movePanel.isSub && movePanel.name === row.area.name) ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                                  border: (movePanel && !movePanel.isSub && movePanel.name === row.area.name) ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.16)',
                                  color: '#cbd5e1', cursor: 'pointer'
                                }}
                              >
                                <FiMove size={11} />
                                Move Area
                              </button>
                              <button
                                type="button"
                                title={hasSubs ? 'Move or merge its Sub-areas out first' : `Delete "${row.area.name}"`}
                                disabled={hasSubs}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hasSubs) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setMovePanel(null);
                                  setDeleteConfirm({ isSub: false, name: row.area.name, parentName: null, rect });
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                  background: hasSubs ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.07)',
                                  border: hasSubs ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(239,68,68,0.28)',
                                  color: hasSubs ? '#64748b' : '#ef4444',
                                  cursor: hasSubs ? 'not-allowed' : 'pointer'
                                }}
                              >
                                <FiTrash2 size={11} />
                              </button>
                              <span style={{
                                fontSize: 11, fontWeight: 700,
                                color: isSelected ? '#f59e0b' : (isDark ? '#d9a74a' : '#b45309'),
                                background: isSelected ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.10)',
                                border: isSelected ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(245, 158, 11, 0.25)',
                                padding: '2px 8px', borderRadius: 8, flexShrink: 0,
                                whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                                minWidth: 54, textAlign: 'center'
                              }}>
                                {row.area.count} {row.area.count === 1 ? 'plot' : 'plots'}
                              </span>
                            </div>
                          </div>

                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasSubs) return;
                              setEditingSubarea(null);
                              setExpandedPrimaries(prev => ({ ...prev, [row.area.name]: !prev[row.area.name] }));
                            }}
                            title={hasSubs ? (isExpanded ? 'Hide sub-areas' : 'View & edit sub-areas') : undefined}
                            className={hasSubs ? 'btn-hover-effect' : ''}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              fontSize: 11, fontWeight: hasSubs ? 600 : 400,
                              opacity: hasSubs ? 0.85 : 0.7,
                              color: hasSubs ? (isDark ? '#d9a74a' : '#b45309') : (isDark ? '#94a3b8' : '#64748b'),
                              paddingLeft: 32, cursor: hasSubs ? 'pointer' : 'default'
                            }}
                          >
                            {hasSubs && (isExpanded
                              ? <FiChevronDown size={12} style={{ flexShrink: 0 }} />
                              : <FiChevronRight size={12} style={{ flexShrink: 0 }} />)}
                            <span style={{
                              whiteSpace: hasSubs ? 'nowrap' : 'normal',
                              overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                              {hasSubs
                                ? `${row.area.subLocations.length} sub-area${row.area.subLocations.length === 1 ? '' : 's'}`
                                : subLocsText}
                            </span>
                          </div>
                        </div>

                        {/* Flat Sub-area list — no per-row expand or embedded plot list
                            any more. The Projects tab already lists every plot, so showing
                            them again here was redundant, and it was also the actual source
                            of the clipping/overlap bugs (a plot list's real height rarely
                            matched its estimated one). Each row is just: pin, name,
                            Move/Delete, plot-count chip — clicking it filters + zooms the
                            map to that Sub-area, same as the old expand-to-navigate did. */}
                        {isExpanded && hasSubs && (
                          <div style={{ paddingLeft: 32, paddingRight: 6, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {row.area.subLocations.map((subName, subIdx) => {
                              const subKey = row.area.name + '::' + subName;
                              const isEditingThis = editingSubarea?.oldName === subName && editingSubarea?.parentName === row.area.name;
                              const subFeatures = row.area.features.filter(f => f.data?.location === subName);
                              const isLastSub = subIdx === row.area.subLocations.length - 1;
                              return (
                                <div key={subKey} style={{
                                  borderBottom: isLastSub ? 'none' : (isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15,23,42,0.06)'),
                                  paddingBottom: isLastSub ? 0 : 6
                                }}>
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isEditingThis) return;
                                      setFilterPrimary(row.area.name);
                                      setFilterSecondary(subName);
                                      if (map && subFeatures.length > 0) {
                                        if (subFeatures.length === 1) zoomToProperty(map, subFeatures[0]);
                                        else fitAllBounds(map, subFeatures);
                                      }
                                    }}
                                    className={isEditingThis ? '' : 'btn-hover-effect'}
                                    title={`Filter & zoom the map to "${subName}"`}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 7,
                                      padding: '9px 8px', borderRadius: 8,
                                      cursor: isEditingThis ? 'default' : 'pointer'
                                    }}
                                  >
                                    <FiMapPin size={12} color="#f59e0b" style={{ flexShrink: 0 }} />
                                    {isEditingThis ? (
                                      <input
                                        autoFocus
                                        value={editingSubarea.value}
                                        onChange={(e) => setEditingSubarea(prev => ({ ...prev, value: e.target.value }))}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') e.currentTarget.blur();
                                          if (e.key === 'Escape') setEditingSubarea(null);
                                        }}
                                        onBlur={() => {
                                          const newName = editingSubarea.value.trim();
                                          if (newName && newName !== editingSubarea.oldName) {
                                            renameArea(editingSubarea.oldName, newName);
                                          }
                                          setEditingSubarea(null);
                                        }}
                                        style={{
                                          flex: 1, fontSize: 13, fontWeight: 600, padding: '4px 7px', borderRadius: 6,
                                          border: '1px solid rgba(245, 158, 11, 0.5)',
                                          background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#fff',
                                          color: isDark ? '#f8fafc' : '#0f172a', outline: 'none'
                                        }}
                                      />
                                    ) : (
                                      <span
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          setEditingSubarea({ oldName: subName, value: subName, parentName: row.area.name });
                                        }}
                                        title="Double-click to rename"
                                        style={{
                                          flex: 1, fontSize: 13, fontWeight: 600,
                                          color: isDark ? '#e2e8f0' : '#1e293b',
                                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                        {subName}
                                      </span>
                                    )}
                                    {!isEditingThis && (
                                      <>
                                        <button
                                          type="button"
                                          title={`Move "${subName}" into another Primary Location`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setDeleteConfirm(null);
                                            setMovePanel(prev => (prev && prev.isSub && prev.name === subName && prev.parentName === row.area.name ? null : {
                                              isSub: true, name: subName, parentName: row.area.name, rect, target: ''
                                            }));
                                          }}
                                          className="btn-hover-effect"
                                          style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 3,
                                            padding: '4px 8px', borderRadius: 999, flexShrink: 0,
                                            fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
                                            background: (movePanel && movePanel.isSub && movePanel.name === subName && movePanel.parentName === row.area.name) ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                                            border: (movePanel && movePanel.isSub && movePanel.name === subName && movePanel.parentName === row.area.name) ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.16)',
                                            color: '#cbd5e1', cursor: 'pointer'
                                          }}
                                        >
                                          <FiMove size={10} />
                                          Move Area
                                        </button>
                                        <button
                                          type="button"
                                          title={`Delete "${subName}"`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setMovePanel(null);
                                            setDeleteConfirm({ isSub: true, name: subName, parentName: row.area.name, rect });
                                          }}
                                          style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: 23, height: 23, borderRadius: '50%', flexShrink: 0,
                                            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.28)',
                                            color: '#ef4444', cursor: 'pointer'
                                          }}
                                        >
                                          <FiTrash2 size={11} />
                                        </button>
                                        <span style={{
                                          fontSize: 10.5, fontWeight: 700, color: isDark ? '#d9a74a' : '#b45309',
                                          background: 'rgba(245, 158, 11, 0.10)', border: '1px solid rgba(245, 158, 11, 0.25)',
                                          padding: '3px 8px', borderRadius: 8, flexShrink: 0, whiteSpace: 'nowrap',
                                          minWidth: 50, textAlign: 'center'
                                        }}>
                                          {subFeatures.length} {subFeatures.length === 1 ? 'plot' : 'plots'}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, width: '100%',
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
            existingPrimaryNames={parentLocationsList.map(a => a.name)}
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

      {/* MOVE PANEL: "Move into…" for either a Primary Location or a Sub-area,
          floated the same way as the sub-area dropdown. Nothing moves until Save
          is clicked. */}
      {movePanel && (
        <>
          <div onClick={() => setMovePanel(null)} style={{ position: 'fixed', inset: 0, zIndex: 2500 }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: movePanel.rect.bottom + 6,
              left: Math.min(movePanel.rect.left, window.innerWidth - 260),
              width: 240,
              zIndex: 2501,
              background: isDark ? 'rgba(15, 23, 42, 0.97)' : '#ffffff',
              border: isDark ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid #e2e8f0',
              borderRadius: 12,
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
              padding: 12
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: 8 }}>
              Move "{movePanel.name}"
            </div>
            <select
              value={movePanel.target}
              onChange={(e) => setMovePanel(prev => ({ ...prev, target: e.target.value }))}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8, marginBottom: 10,
                background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#fff',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12.5, outline: 'none'
              }}
            >
              <option value="">
                {movePanel.isSub ? `Keep inside ${movePanel.parentName}` : 'Keep as a Primary Area'}
              </option>
              {movePanel.isSub && (
                <option value="__promote__">Make it a Primary Area</option>
              )}
              {parentLocationsList
                .filter(a => a.name !== movePanel.name && (!movePanel.isSub || a.name !== movePanel.parentName))
                .map(a => (
                  <option key={a.name} value={a.name}>
                    Move into {a.name}
                  </option>
                ))}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={async () => {
                  if (!movePanel.target) { setMovePanel(null); return; }
                  if (movePanel.isSub) {
                    if (movePanel.target === '__promote__') {
                      promoteSubToPrimary(movePanel.name, movePanel.parentName);
                    } else {
                      moveSubArea(movePanel.name, movePanel.parentName, movePanel.target);
                    }
                  } else {
                    mergeAreaIntoPrimary(movePanel.name, movePanel.target);
                  }
                  setMovePanel(null);
                  toast.success('Changes saved', {
                    style: { background: '#0f172a', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)' }
                  });
                  // Best-effort: push the moved features' new location to the sheet.
                  try {
                    const moved = useMapStore.getState().features.filter(f => {
                      const loc = f.data?.location;
                      const par = f.data?.parentLocation;
                      return movePanel.isSub
                        ? loc?.toLowerCase() === movePanel.name.toLowerCase()
                        : par?.toLowerCase() === movePanel.name.toLowerCase();
                    });
                    for (const f of moved) {
                      await syncFeatureToSheet(spreadsheetId, f, 'update');
                    }
                  } catch (err) {
                    console.warn('Move: sheet sync failed (kept locally):', err);
                  }
                }}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                  background: '#38bdf8', color: '#001018', fontSize: 12, fontWeight: 800, cursor: 'pointer'
                }}
              >
                💾 Save changes
              </button>
              <button
                type="button"
                onClick={() => setMovePanel(null)}
                style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* DELETE CONFIRM: staged — plots are always rescued into "Unassigned"
          rather than deleted, so nothing with real survey data on it is lost. */}
      {deleteConfirm && (
        <>
          <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 2500 }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: deleteConfirm.rect.bottom + 6,
              left: Math.min(deleteConfirm.rect.left, window.innerWidth - 260),
              width: 240,
              zIndex: 2501,
              background: isDark ? 'rgba(15, 23, 42, 0.97)' : '#ffffff',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 12,
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
              padding: 12
            }}
          >
            <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 600, marginBottom: 10 }}>
              Delete "{deleteConfirm.name}"? This can't be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={async () => {
                  const { isSub, name, parentName } = deleteConfirm;
                  const beforeCount = useMapStore.getState().features.filter(f =>
                    f.data?.location?.toLowerCase() === 'unassigned' && f.data?.parentLocation?.toLowerCase() === 'unassigned'
                  ).length;
                  if (isSub) {
                    deleteSubLocation(parentName, name);
                  } else {
                    deleteArea(name);
                  }
                  setDeleteConfirm(null);
                  const rescued = useMapStore.getState().features.filter(f =>
                    f.data?.location?.toLowerCase() === 'unassigned' && f.data?.parentLocation?.toLowerCase() === 'unassigned'
                  );
                  const rescuedNow = rescued.length - beforeCount;
                  toast.success(
                    `"${name}" deleted` + (rescuedNow > 0 ? ` — its plots moved to Unassigned Plots` : ''),
                    { style: { background: '#0f172a', color: '#fca5a5', border: '1px solid rgba(248, 113, 113, 0.4)' } }
                  );
                  // Best-effort: push the rescued features' new "Unassigned" location.
                  try {
                    for (const f of rescued) {
                      await syncFeatureToSheet(spreadsheetId, f, 'update');
                    }
                  } catch (err) {
                    console.warn('Delete: sheet sync failed (kept locally):', err);
                  }
                }}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                  background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer'
                }}
              >
                🗑 Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
