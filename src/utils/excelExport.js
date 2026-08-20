import * as XLSX from 'xlsx';

export function exportPolygonCoordinates(features = [], filename = 'map_export.xlsx') {
  const headers = ['id', 'name', 'tp', 'op', 'fp', 'area', 'location', 'parent_location', 'landmark', 'type', 'remarks', 'coordinates'];
  
  const dataRows = features.map(f => {
    const d = f.data || {};
    const coordsStr = f.coordinates ? f.coordinates.map(c => `${c.lat},${c.lng}`).join(';') : (f.position ? `${f.position.lat},${f.position.lng}` : '');
    return [
      f.id || '',
      d.name || '',
      d.tp || '',
      d.op || '',
      d.fp || '',
      d.area != null ? String(d.area) : '',
      d.location || '',
      d.parentLocation || d.parent_location || '',
      d.landmark || '',
      d.type || '',
      d.remarks || '',
      coordsStr
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Features');
  XLSX.writeFile(wb, filename);
}
