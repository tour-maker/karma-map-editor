import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DocumentViewerPage from './components/DocumentViewerPage.jsx'

const isViewer = window.location.pathname.startsWith('/viewer/');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isViewer ? <DocumentViewerPage /> : <App />}
  </StrictMode>,
)
