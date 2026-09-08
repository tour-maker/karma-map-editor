import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function DocumentViewerPage() {
  const pathParts = window.location.pathname.split('/');
  const documentId = pathParts[pathParts.length - 1];
  const urlParams = new URLSearchParams(window.location.search);
  const documentName = urlParams.get('name') || 'Document Viewer';

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
          center={[0, 0]} 
          zoom={1} 
          minZoom={0}
          maxZoom={6}
          crs={L.CRS.Simple}
          style={{ height: '100%', width: '100%', background: '#cbd5e1' }}
          attributionControl={false}
        >
          <TileLayer
            url={`http://localhost:5050/api/documents/tiles/${documentId}/{z}/{x}/{y}`}
            noWrap={true}
            bounds={[[-256, 0], [0, 256]]} // simple bounds for starting
          />
        </MapContainer>
      </div>
    </div>
  );
}
