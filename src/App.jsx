import { useEffect } from 'react'
import './App.css'
import MapEditor from './components/MapEditor'
import { GoogleMapProvider } from './context/GoogleMapContext'
import { Toaster } from 'react-hot-toast'
import { useMapStore } from './store/useMapStore'

function App() {
  useEffect(() => {
    // If URL ends with 'admin', set edit mode. Otherwise viewer mode.
    if (window.location.pathname.replace(/\/$/, '').endsWith('admin')) {
      useMapStore.getState().setAppMode('edit');
      document.body.classList.add('is-admin');
    } else {
      useMapStore.getState().setAppMode('viewer');
      document.body.classList.remove('is-admin');
    }
  }, []);

  return (
    <GoogleMapProvider>
      <Toaster position="top-center" />
      <MapEditor />
    </GoogleMapProvider>
  )
}

export default App
