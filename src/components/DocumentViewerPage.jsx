import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_BASE_URL } from '../config/api';

// L.CRS.Simple has Y increasing upwards (normal Cartesian).
// Standard XYZ tiles expect Y to increase downwards.
// We create a custom CRS that flips the Y-axis so positive Latitude goes down.
const ImageCRS = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(1, 0, 1, 0)
});

export default function DocumentViewerPage() {
  const [meta, setMeta] = useState(null);
  
  const pathParts = window.location.pathname.split('/');
  const documentId = pathParts[pathParts.length - 1];
  const urlParams = new URLSearchParams(window.location.search);
  const documentName = urlParams.get('name') || 'Document Viewer';

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/documents/meta/${documentId}`)
      .then(r => r.json())
      .then(data => setMeta(data))
      .catch(err => console.error('Failed to fetch doc metadata:', err));
  }, [documentId]);

  if (!meta) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', background: '#0f172a', color: '#cbd5e1' }}>
        Loading document map...
      </div>
    );
  }

  // Calculate the exact bounds in L.CRS.Simple coordinates (zoom 0 equivalent)
  // At maxZoom, the map is (maxX + 1) * 256 pixels wide, and (maxY + 1) * 256 pixels high.
  // In L.CRS.Simple, map units equal pixels at zoom 0. So we divide by 2^maxZoom.
  const scale = Math.pow(2, meta.maxZoom);
  const mapWidth = ((meta.maxX + 1) * 256) / scale;
  const mapHeight = ((meta.maxY + 1) * 256) / scale;
  
  // Since lat is Y and lng is X, bounds are [[0, 0], [Y, X]]
  const documentBounds = [[0, 0], [mapHeight, mapWidth]];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#0f172a' }}>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '16px 24px', 
        background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 18, fontWeight: 600 }}>{documentName}</h2>
      </div>
      
      <div style={{ flex: 1, position: 'relative', background: '#1e293b' }}>
        <MapContainer 
          center={[mapHeight / 2, mapWidth / 2]} // Center precisely on the document
          zoom={1} 
          minZoom={0}
          maxZoom={7}
          crs={ImageCRS}
          style={{ height: '100%', width: '100%', background: '#cbd5e1' }}
          attributionControl={false}
          maxBounds={documentBounds}
          maxBoundsViscosity={1.0}
        >
          <TileLayer
            url={`${API_BASE_URL}/api/documents/tiles/${documentId}/{z}/{x}/{y}`}
            noWrap={true}
            bounds={documentBounds}
            maxNativeZoom={meta.maxZoom}
          />
        </MapContainer>
      </div>
    </div>
  );
}

