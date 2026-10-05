const keyOf = (name) => String(name ?? '').trim().toLowerCase();

// Unique area names, ignoring capital letters and surrounding spaces ("S1" and "s1" are
// the same area). The first spelling given wins, so callers list the most trusted source
// (the Areas sheet) first. Empty names are dropped.
export function uniqueNames(names = []) {
  const seen = new Map();
  names.forEach((name) => {
    const text = String(name ?? '').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (!seen.has(key)) seen.set(key, text);
  });
  return Array.from(seen.values());
}

// Sub-areas of a Primary Location, gathered from every place they can live. A source key
// that matches the Primary ignoring capitals counts as the same Primary, and the result
// has no repeated names. The Areas sheet is listed first so its spelling is the one shown.
export function collectSubAreas(parent, { syncedAreas = [], dynamicMap = {}, categoryMap = {} } = {}) {
  const key = keyOf(parent);
  if (!key) return [];
  const fromMap = (obj) => Object.keys(obj).filter((k) => keyOf(k) === key).flatMap((k) => obj[k] || []);
  return uniqueNames([
    ...syncedAreas.filter((area) => keyOf(area?.parent) === key).map((area) => area?.secondary),
    ...fromMap(categoryMap),
    ...fromMap(dynamicMap),
  ]);
}
