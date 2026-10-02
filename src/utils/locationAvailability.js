import { isPropertyPolygon, determineParentLocation } from '../config/categories';
import { isFeatureMatchingUnit } from './unitFilter';

// A real, visible property polygon that matches the active unit + category. This is the
// same test the "N found" counter uses, so a location with none could only ever read
// "0 found". Landmarks (map pins) and empty areas added without any plot never count.
export function isMatchingProperty(feature, unit, type) {
  return isPropertyPolygon(feature) &&
    feature.style?.visible !== false &&
    isFeatureMatchingUnit(feature, unit) &&
    (!type || feature.data?.type === type);
}

// Primary (parent) locations that have at least one matching property.
export function getParentsWithProperties(features = [], unit = null, type = null) {
  const parents = new Set();
  features.forEach(feature => {
    if (!isMatchingProperty(feature, unit, type)) return;
    const loc = feature.data?.location;
    if (!loc) return;
    parents.add(feature.data?.parentLocation || feature.data?.parent_location || determineParentLocation(loc));
  });
  return parents;
}

// True when at least one matching property sits in exactly this (sub-)location.
export function hasPropertyInLocation(features = [], location, unit = null, type = null) {
  return features.some(feature =>
    isMatchingProperty(feature, unit, type) && feature.data?.location === location
  );
}
