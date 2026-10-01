import { useEffect } from 'react'
import './App.css'
import MapEditor from './components/MapEditor'
import { GoogleMapProvider } from './context/GoogleMapContext'
import { Toaster } from 'react-hot-toast'
import { useMapStore } from './store/useMapStore'
import GoogleSheetsConnect from './components/GoogleSheetsConnect'
import AdminAuthOverlay from './components/ui/AdminAuthOverlay'
import { setAccessToken } from './services/googleSheets'

function App() {
  useEffect(() => {
    const { googleAccessToken } = useMapStore.getState();

    // Admin accounts do not survive a page refresh either — same as viewer
    // accounts below: every fresh load/reload starts signed out, so the
    // admin has to log back in rather than picking up an old JWT. Previously
    // this verified the stored JWT with the backend and silently
    // re-authenticated if it was still valid, which meant refreshing the
    // admin page never actually signed anyone out.
    localStorage.removeItem('karmaAdminJWT');
    useMapStore.getState().setIsAdminAuthenticated(false);

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
  return (
    <GoogleMapProvider>
      {appMode === 'edit' && !isAdminAuthenticated && <AdminAuthOverlay />}
      {/* zIndex above every modal (UserAuthModal, PropertyInfoPanel, etc. all use 99999) —
          react-hot-toast's default container z-index otherwise sits behind them, so any
          toast fired while a modal is open (e.g. the signup-conflict error) rendered behind
          the modal's backdrop-blur: visible but smeared and unreadable, not actually hidden. */}
      <Toaster position="top-center" containerStyle={{ zIndex: 2000002 }} />
      <GoogleSheetsConnect />
      <MapEditor />
    </GoogleMapProvider>
  )
}

export default App
