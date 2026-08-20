/**
 * Utility helper to determine and filter feature area units (Sq. Yard vs Wingha)
 */

export function getFeatureAreaUnit(feature) {
  if (!feature || !feature.data) return null;
  const d = feature.data;

  // 1. Explicit areaUnit field
  if (d.areaUnit) {
    const norm = String(d.areaUnit).toLowerCase();
    if (/wingha|vingha|vigha/.test(norm)) return 'wingha';
    if (/yard|sqyd|sq/.test(norm)) return 'yards';
  }

  // 2. Check all string values in feature.data and extendedData
  const allTexts = [
    d.sheetName,
    d.project,
    d.layerName,
    d.name,
    d.area,
    d.remarks,
    d.extendedData ? JSON.stringify(d.extendedData) : ''
  ].filter(Boolean).map(s => String(s).toLowerCase()).join(' ');

  const hasWingha = /wingha|vingha|vigha/.test(allTexts);
  const hasYards = /sq\.?\s*yards?|sqyd|square\s*yards?|sq\.?\s*yard/.test(allTexts);

  if (hasWingha && !hasYards) return 'wingha';
  if (hasYards && !hasWingha) return 'yards';
  if (hasWingha) return 'wingha';
  if (hasYards) return 'yards';

  return null;
}

export function isFeatureMatchingUnit(feature, globalAreaUnit) {
  if (!feature) return false;

  // Landmarks are independent of area units — always preserve landmarks!
  if (feature.id?.startsWith('landmark-') || feature.data?.type === 'Landmark') {
    return true;
  }

  // If no unit filter is active (both unit filters OFF by default), show ALL features!
  if (!globalAreaUnit) {
    return true;
  }

  const unit = getFeatureAreaUnit(feature);

  // Untagged features (raw KML polygons) are always kept visible!
  if (unit === null) {
    return true;
  }

  // If user activated Wingha filter: hide Sq.Yard features
  if (globalAreaUnit === 'wingha') {
    return unit !== 'yards';
  }

  // If user activated Sq.Yard filter: hide Wingha features
  if (globalAreaUnit === 'yards' || globalAreaUnit === 'sq. yard') {
    return unit !== 'wingha';
  }

  return true;
}
