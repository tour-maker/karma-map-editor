import './App.css'
import MapEditor from './components/MapEditor'
import { GoogleMapProvider } from './context/GoogleMapContext'
import { Toaster } from 'react-hot-toast'

function App() {
  return (
    <GoogleMapProvider>
      <Toaster position="top-center" />
      <MapEditor />
    </GoogleMapProvider>
  )
}

export default App
