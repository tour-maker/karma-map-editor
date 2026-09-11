import { GoogleMap, useJsApiLoader, Marker, Polygon } from '@react-google-maps/api';
import { useCallback, useRef, useEffect, useState } from 'react';
import SearchBox from './SearchBox';
import PolygonDrawingManager from './PolygonDrawingManager';
import ProjectsPanel from './ProjectsPanel';
import PropertyInfoPanel from './PropertyInfoPanel';
import AddLandmarkModal from './AddLandmarkModal';
import CustomZoomControl from './ui/CustomZoomControl';
import LocateControl from './ui/LocateControl';
import FilterBar from './ui/FilterBar';
import TopStatsBar from './ui/TopStatsBar';
import RightActionDock from './ui/RightActionDock';
import WhatsAppCTA from './ui/WhatsAppCTA';
import FeatureInstanceManager from './FeatureInstanceManager';
import LandmarkManager from './LandmarkManager';
import UserSubmissionModal from './ui/UserSubmissionModal';
import UserAuthModal from './ui/UserAuthModal';
import MyRequestsPanel from './ui/MyRequestsPanel';
import { FiUser } from 'react-icons/fi';
import { useMapStore } from '../store/useMapStore';
import { useGoogleMap, useSetGoogleMap } from '../context/GoogleMapContext';
import {
  calculatePolygonCenter,
  fitAllBounds,
  getGoogleMapsApiKey,
  getPolygonCoordinates,
  GOOGLE_MAPS_LIBRARIES,
  zoomToProperty
} from '../services/googleMaps';
import { isPointInPolygon } from '../utils/matchPropertiesToPolygons';
import { validateFeature } from '../utils/validation';
import toast from 'react-hot-toast';

const defaultCenter = {
  lat: 21.1702,
  lng: 72.8311
};

export default function MapEditor() {
  const apiKey = getGoogleMapsApiKey();
  const map = useGoogleMap();
  const setMap = useSetGoogleMap();

  // Zustand State
  const appMode = useMapStore(state => state.appMode);
  const theme = useMapStore(state => state.theme);
  //   const uiHidden = useMapStore(state => state.uiHidden);
  const showLabels = useMapStore(state => state.showLabels);
  const features = useMapStore(state => state.features);
  //   const selectedFeatureId = useMapStore(state => state.selectedFeatureId);
  const setSelectedFeatureId = useMapStore(state => state.setSelectedFeatureId);
  const addFeatures = useMapStore(state => state.addFeatures);
  //   const updateFeature = useMapStore(state => state.updateFeature);
  //   const removeFeature = useMapStore(state => state.removeFeature);
  const setIsInfoPanelOpen = useMapStore(state => state.setIsInfoPanelOpen);
  //   const isInfoPanelOpen = useMapStore(state => state.isInfoPanelOpen);
  //   const globalAreaUnit = useMapStore(state => state.globalAreaUnit);
  const previewSubmission = useMapStore(state => state.previewSubmission);
  const viewerUsername = useMapStore(state => state.viewerUsername);

  const isDark = theme === 'dark';
  const containerStyle = {
    width: '100%',
    height: '100vh',
    minHeight: '100vh',
    overflow: 'hidden',
    background: isDark ? '#020617' : '#0f172a'
  };

  const drawingManagerRef = useRef(null);
  const [searchMarkerPos, setSearchMarkerPos] = useState(null);
  const [userSubmissionData, setUserSubmissionData] = useState(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showMyRequests, setShowMyRequests] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      useMapStore.getState().setAppMode('viewer');
    }
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  const handleMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, [setMap]);

  const handlePlaceSelected = useCallback(
    (place) => {
      if (!place?.geometry?.location || !map) return;
      const lat = typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : place.geometry.location.lat;
      const lng = typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : place.geometry.location.lng;
      const nextCenter = { lat, lng };

      const currentFeatures = useMapStore.getState().features;

      // 1. Check if place had an explicitly matched feature from SearchBox
      let targetFeature = place.matchedFeature || null;

      // 2. Check if search coordinates fall inside any polygon feature
      if (!targetFeature) {
        targetFeature = currentFeatures.find(f => {
          if (f.type === 'polygon' && Array.isArray(f.coordinates) && f.coordinates.length >= 3) {
            return isPointInPolygon(nextCenter, f.coordinates);
          }
          return false;
        });
      }

      // Set classic Red Pin marker at searched location
      setSearchMarkerPos(nextCenter);

      // If a polygon is matched, select it and open info panel directly!
      if (targetFeature) {
        setSelectedFeatureId(targetFeature.id);
        setIsInfoPanelOpen(true);
        zoomToProperty(map, targetFeature);
      } else {
        map.panTo(nextCenter);
        map.setZoom(15);
      }
    },
    [map, setSelectedFeatureId, setIsInfoPanelOpen]
  );

  const handlePolygonComplete = useCallback((polygonInstance) => {
    if (!polygonInstance || !polygonInstance.isCompleted) return;

    const coordinates = getPolygonCoordinates(polygonInstance);
    if (coordinates.length < 3) return;

    const center = calculatePolygonCenter(coordinates);
    if (!center) return;

    let calculatedArea = null;
    if (window.google?.maps?.geometry?.spherical) {
      const path = coordinates.map(c => new window.google.maps.LatLng(c.lat, c.lng));
      const areaSqMeters = window.google.maps.geometry.spherical.computeArea(path);
      calculatedArea = Math.round(areaSqMeters * 1.19599); // convert sq meters to sq yards
    }

    const currentMode = useMapStore.getState().appMode;

    // Viewer Mode Interception for Submissions
    if (currentMode === 'viewer') {
      setUserSubmissionData({ coordinates, area: calculatedArea });

      // Remove the instance from map so it doesn't clutter until approved
      polygonInstance.setMap(null);
      if (Array.isArray(polygonInstance.pathListeners)) {
        polygonInstance.pathListeners.forEach((listener) => {
          window.google?.maps.event.removeListener(listener);
        });
      }
      return;
    }

    const currentFeatures = useMapStore.getState().features;
    let maxS = 0;
    currentFeatures.forEach(f => {
      if (f.id && f.id.startsWith('s')) {
        const num = parseInt(f.id.slice(1), 10);
        if (!isNaN(num) && num > maxS) {
          maxS = num;
        }
      }
    });
    const id = `s${maxS + 1}`;
    const newFeature = {
      id,
      source: 'drawn',
      type: 'polygon',
      coordinates,
      center,
      data: {
        tp: '',
        op: '',
        fp: '',
        area: calculatedArea || '',
        location: 'Surat',
        parentLocation: 'Surat',
        landmark: '',
        type: 'Freehold',
        remarks: ''
      },
      style: {
        fillColor: '#facc15',
        fillOpacity: 0.4,
        strokeColor: '#facc15',
        strokeWeight: 2,
        visible: true
      }
    };

    addFeatures([validateFeature(newFeature)]);
    const store = useMapStore.getState();
    store.setSelectedFeatureId(id);
    store.setIsInfoPanelOpen(true);
    store.setAppMode('edit');
    toast.success('Polygon added — area calculated');

    // Remove the instance drawn by PolygonDrawingManager, FeatureInstanceManager will redraw it.
    polygonInstance.setMap(null);
    if (Array.isArray(polygonInstance.pathListeners)) {
      polygonInstance.pathListeners.forEach((listener) => {
        window.google?.maps.event.removeListener(listener);
      });
    }

  }, [features, addFeatures]);

  // Auto-load from Google Sheets is handled by GoogleSheetsConnect on mount.
  // File-based (Excel / KML / GeoJSON) import has been removed — the Google
  // Sheet is now the single source of truth for map data.

  const [isPlacingLandmark, setIsPlacingLandmark] = useState(false);
  const [landmarkModalPos, setLandmarkModalPos] = useState(null);

  const handleStartAddLandmark = () => {
    setIsPlacingLandmark(true);
    toast('Click anywhere on the map to place your Landmark pin', { icon: '📍' });
  };

  if (!apiKey) {
    return <div style={{ padding: 24, fontFamily: 'sans-serif', color: 'white' }}>Google Maps API key is missing.</div>;
  }

  if (loadError) {
    return <div style={{ padding: 24, fontFamily: 'sans-serif', color: 'white' }}>Error loading Google Maps API.</div>;
  }

  return (
    <div style={containerStyle}>
      {isLoaded && <SearchBox onPlaceSelected={handlePlaceSelected} />}

      {appMode === 'edit' && (
        <ProjectsPanel
          onAddProject={() => drawingManagerRef.current?.startDrawing()}
          onAddLandmark={handleStartAddLandmark}
        />
      )}

      {appMode === 'viewer' && (
        <div style={{
          position: 'absolute', top: 20, left: 20, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 16,
          background: 'rgba(15, 23, 42, 0.85)', padding: '8px 10px 8px 14px', borderRadius: 12,
          backdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
        }}>
          <a
            href="http://karmagroup.co.in/Home/Index?Area=Surat&Latitude=21.1702&Longitude=72.8311"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', cursor: 'pointer', outline: 'none' }}
          >
            <img
              src="https://karmagroup.co.in/images/Karma%20logo%20R%20PNG%20(1)%20(1).png"
              alt="Karma Realtors Logo"
              style={{ height: 32, maxWidth: 180, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3))' }}
            />
          </a>
          <button
            type="button"
            onClick={() => drawingManagerRef.current?.startDrawing()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 12px', background: 'rgba(245, 158, 11, 0.12)', color: '#fde68a', border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)'; e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <span style={{ fontSize: 14 }}>+</span> Add Your Property
          </button>
          <button
            type="button"
            onClick={() => viewerUsername ? setShowMyRequests(true) : setShowAccountModal(true)}
            title={viewerUsername ? `Signed in as ${viewerUsername} — view your requests` : 'Sign in to submit & track your property requests'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 12px', background: 'rgba(255, 255, 255, 0.06)', color: '#e2e8f0', border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; }}
          >
            <FiUser size={14} /> {viewerUsername || 'Sign In'}
          </button>
        </div>
      )}
      <FilterBar />
      <RightActionDock />
      <WhatsAppCTA />
      <PropertyInfoPanel />

      {userSubmissionData && !viewerUsername && (
        <UserAuthModal
          title="Sign In to Submit"
          subtitle="Create a free account (or sign in) so you can track the status of this request."
          onClose={() => setUserSubmissionData(null)}
          onSuccess={() => { /* userSubmissionData stays set — next render shows UserSubmissionModal */ }}
        />
      )}

      {userSubmissionData && viewerUsername && (
        <UserSubmissionModal
          data={userSubmissionData}
          onClose={() => setUserSubmissionData(null)}
          onSubmitSuccess={() => setUserSubmissionData(null)}
        />
      )}

      {showAccountModal && (
        <UserAuthModal
          onClose={() => setShowAccountModal(false)}
          onSuccess={() => { setShowAccountModal(false); setShowMyRequests(true); }}
        />
      )}

      {showMyRequests && viewerUsername && (
        <MyRequestsPanel onClose={() => setShowMyRequests(false)} />
      )}

      {landmarkModalPos && (
        <AddLandmarkModal
          position={landmarkModalPos}
          onClose={() => setLandmarkModalPos(null)}
        />
      )}

      {isLoaded && (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={13}
          onLoad={handleMapLoad}
          onUnmount={() => setMap(null)}
          onClick={(e) => {
            if (isPlacingLandmark && e.latLng) {
              setLandmarkModalPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              setIsPlacingLandmark(false);
              return;
            }
            // Deselect any selected polygon and close panel when clicking on the map
            const appModeObj = useMapStore.getState();
            if (appModeObj.selectedFeatureId) {
              appModeObj.setSelectedFeatureId(null);
            }
            appModeObj.setIsInfoPanelOpen(false);
            setSearchMarkerPos(null);
          }}
          options={{
            gestureHandling: 'greedy',
            backgroundColor: '#000000',
            disableDefaultUI: true, // we use custom zoom control now
            zoomControl: false, // disable native zoom control
            mapTypeId: showLabels ? 'hybrid' : 'satellite',
            tilt: 0,
            minZoom: 9,
            restriction: {
              latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
              strictBounds: true
            },
            draggableCursor: appMode === 'add' || isPlacingLandmark ? 'pointer' : null
          }}
        >
          <FeatureInstanceManager />
          <LandmarkManager />

          {searchMarkerPos && (
            <Marker
              position={searchMarkerPos}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
              }}
              animation={window.google?.maps?.Animation?.DROP}
            />
          )}

          {previewSubmission && previewSubmission.coordinates && (
            <Polygon
              paths={previewSubmission.coordinates}
              options={{
                fillColor: '#3b82f6',
                fillOpacity: 0.6,
                strokeColor: '#60a5fa',
                strokeWeight: 4,
                zIndex: 9999,
                clickable: false
              }}
            />
          )}

          <PolygonDrawingManager
            ref={drawingManagerRef}
            map={map}
            appMode={appMode}
            onPolygonComplete={handlePolygonComplete}
          />
        </GoogleMap>
      )}
    </div>
  );
}
