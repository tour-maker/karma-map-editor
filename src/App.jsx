import { useEffect, useState } from 'react'
import './App.css'
import MapEditor from './components/MapEditor'
import { GoogleMapProvider } from './context/GoogleMapContext'
import { Toaster } from 'react-hot-toast'
import { useMapStore } from './store/useMapStore'
import GoogleSheetsConnect from './components/GoogleSheetsConnect'
import AdminAuthOverlay from './components/ui/AdminAuthOverlay'
import { initGoogleIdentity, setAccessToken, startAutoRefresh } from './services/googleSheets'

function App() {
  useEffect(() => {
    const { googleClientId, googleAccessToken } = useMapStore.getState();

    // Verify admin JWT with backend on every page load
    const storedJWT = localStorage.getItem('karmaAdminJWT');
    if (storedJWT) {
      fetch('http://localhost:5050/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: storedJWT })
      })
        .then(r => r.json())
        .then(data => {
          if (data.valid) {
            useMapStore.getState().setIsAdminAuthenticated(true);
          } else {
            localStorage.removeItem('karmaAdminJWT');
            useMapStore.getState().setIsAdminAuthenticated(false);
          }
        })
        .catch(() => {
          // If server unreachable, don't grant access
          useMapStore.getState().setIsAdminAuthenticated(false);
        });
    }

    // Hydrate Google token from store if it exists
    if (googleAccessToken) {
      setAccessToken(googleAccessToken);
    }

    initGoogleIdentity(googleClientId, (token) => {
      setAccessToken(token);
      useMapStore.setState({ googleSheetsConnected: true, googleAccessToken: token });
      startAutoRefresh();
    });

    // Initial routing logic
    if (window.location.pathname.replace(/\/$/, '').endsWith('admin')) {
      useMapStore.getState().setAppMode('edit');
      document.body.classList.add('is-admin');
    } else {
      useMapStore.getState().setAppMode('viewer');
      document.body.classList.remove('is-admin');
    }

    // Auto-switch modes on mobile based on orientation
    const handleOrientationChange = () => {
      const isMobilePortrait = window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches;
      const isMobileLandscape = window.matchMedia("(max-height: 500px) and (orientation: landscape)").matches;
      
      if (isMobilePortrait) {
        useMapStore.getState().setAppMode('viewer');
        document.body.classList.remove('is-admin');
        if (window.location.pathname.replace(/\/$/, '').endsWith('admin')) {
          window.history.replaceState(null, '', '/');
        }
      } else if (isMobileLandscape) {
        useMapStore.getState().setAppMode('edit');
        document.body.classList.add('is-admin');
        if (!window.location.pathname.replace(/\/$/, '').endsWith('admin')) {
          window.history.replaceState(null, '', '/admin');
        }
      }
    };

    handleOrientationChange();
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  const appMode = useMapStore(state => state.appMode);
  const isAdminAuthenticated = useMapStore(state => state.isAdminAuthenticated);

  return (
    <GoogleMapProvider>
      {appMode === 'edit' && !isAdminAuthenticated && <AdminAuthOverlay />}
      {appMode === 'edit' && isAdminAuthenticated && (
        <button
          onClick={() => {
            localStorage.removeItem('karmaAdminJWT');
            useMapStore.getState().setIsAdminAuthenticated(false);
          }}
          style={{
            position: 'fixed',
            top: 14,
            right: 16,
            zIndex: 1000,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            color: '#ef4444',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.5px',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
        >
          Logout
        </button>
      )}
      <Toaster position="top-center" />
      <GoogleSheetsConnect />
      <MapEditor />
    </GoogleMapProvider>
  )
}

export default App
