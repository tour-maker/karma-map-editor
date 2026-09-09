import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// L.CRS.Simple has Y increasing upwards (normal Cartesian).
// Standard XYZ tiles expect Y to increase downwards.
// We create a custom CRS that flips the Y-axis so positive Latitude goes down.
const ImageCRS = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(1, 0, 1, 0)
});

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
          center={[128, 128]} // Center roughly on the first tile
          zoom={1} 
          minZoom={0}
          maxZoom={6}
          crs={ImageCRS}
          style={{ height: '100%', width: '100%', background: '#cbd5e1' }}
          attributionControl={false}
        >
          <TileLayer
            url={`http://localhost:5050/api/documents/tiles/${documentId}/{z}/{x}/{y}`}
            noWrap={true}
          />
        </MapContainer>
      </div>
    </div>
  );
}
