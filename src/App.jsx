import { useEffect, useState } from 'react'
import './App.css'
import MapEditor from './components/MapEditor'
import { GoogleMapProvider } from './context/GoogleMapContext'
import { Toaster } from 'react-hot-toast'
import { useMapStore } from './store/useMapStore'
import GoogleSheetsConnect from './components/GoogleSheetsConnect'
import AdminAuthOverlay from './components/ui/AdminAuthOverlay'
import { setAccessToken } from './services/googleSheets'
import { API_BASE_URL } from './config/api'

function App() {
  useEffect(() => {
    const { googleAccessToken } = useMapStore.getState();

    // Verify admin JWT with backend on every page load
    const storedJWT = localStorage.getItem('karmaAdminJWT');
    if (storedJWT) {
      fetch(`${API_BASE_URL}/api/auth/verify`, {
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

    // Viewer accounts do not survive a page refresh: every fresh load starts signed out,
    // and Map Labels always starts OFF (stale values from older persisted storage are reset too).
    localStorage.removeItem('karmaUserJWT');
    useMapStore.setState({ viewerUsername: null, showLabels: false });

    // Hydrate Google token from store if it exists
    if (googleAccessToken) {
      setAccessToken(googleAccessToken);
    }

    // Initial routing logic
    const isAdminRoute = window.location.pathname.replace(/\/$/, '').endsWith('admin');
    if (isAdminRoute) {
      useMapStore.getState().setAppMode('edit');
      document.body.classList.add('is-admin');
    } else {
      useMapStore.getState().setAppMode('viewer');
      document.body.classList.remove('is-admin');
    }

    // Google Sheets reads/writes now go entirely through our own backend (which
    // uses a service account — see server/sheetsHelper.js and the backendFetch
    // wrapper in services/googleSheets.js), not this browser-side Google OAuth
    // token client. That migration happened a while ago, but this leftover
    // auto sign-in call was never removed. It served no purpose any more (its
    // token isn't read by anything) and the production domain was never
    // registered as an authorized JavaScript origin for this OAuth client, so
    // it silently failed with an origin_mismatch error — which, unlike a
    // normal silent-login failure, Google renders as a real, visible "Access
    // blocked" page instead of a console warning, so an admin loading /admin
    // could see it via a triggered popup/tab. Removed entirely rather than
    // registering the origin, since there's no working feature left that
    // needs it — see initGoogleIdentity/silentLogin in services/googleSheets.js
    // for the (now-unused) implementation if a real Sheets OAuth flow is ever
    // needed again in the future.

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
  const googleSheetsConnected = useMapStore(state => state.googleSheetsConnected);

  return (
    <GoogleMapProvider>
      {appMode === 'edit' && !isAdminAuthenticated && <AdminAuthOverlay />}
      {appMode === 'edit' && isAdminAuthenticated && (
        <div style={{ position: 'fixed', top: 14, right: 16, zIndex: 1000, display: 'flex', gap: 8 }}>
          {/* <button
            onClick={() => requestLogin()}
            title={googleSheetsConnected ? 'Re-authenticate with Google Sheets' : 'Connect to Google Sheets'}
            style={{
              background: googleSheetsConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              border: googleSheetsConnected ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(245, 158, 11, 0.5)',
              color: googleSheetsConnected ? '#22c55e' : '#f59e0b',
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
          >
            {googleSheetsConnected ? 'Google Sheets Connected' : 'Connect Google Sheets'}
          </button> */}
          <span style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#f59e0b',
            borderRadius: 12,
            padding: '3px 9px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            backdropFilter: 'blur(8px)',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}>
            Map Editor
          </span>
        </div>
      )}
      <Toaster position="top-center" />
      <GoogleSheetsConnect />
      <MapEditor />
    </GoogleMapProvider>
  )
}

export default App
