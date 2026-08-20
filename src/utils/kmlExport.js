export function exportPolygonsToKml(features = [], filename = 'map_export.kml') {
  let placemarks = '';

  features.forEach(f => {
    const name = f.data?.name || f.id || 'Placemark';
    const desc = f.data?.remarks || '';
    if (f.type === 'polygon' && f.coordinates && f.coordinates.length >= 3) {
      const coordString = f.coordinates.map(c => `${c.lng},${c.lat},0`).join(' ');
      const firstCoord = `${f.coordinates[0].lng},${f.coordinates[0].lat},0`;
      placemarks += `
    <Placemark>
      <name>${name}</name>
      <description>${desc}</description>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordString} ${firstCoord}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
    } else if (f.type === 'marker' && f.position) {
      placemarks += `
    <Placemark>
      <name>${name}</name>
      <description>${desc}</description>
      <Point>
        <coordinates>${f.position.lng},${f.position.lat},0</coordinates>
      </Point>
    </Placemark>`;
    }
  });

  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Exported Features</name>${placemarks}
  </Document>
</kml>`;

  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
