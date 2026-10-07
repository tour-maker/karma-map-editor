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

// The spelling already in use for a name (ignoring capitals), or the name as typed when it is new.
export function matchExistingName(name, options = []) {
  const text = String(name ?? '').trim();
  const found = options.find((option) => keyOf(option) === keyOf(text));
  return found ?? text;
}

// Tells whether a request names an area the map does not know yet. A request whose location equals
// its Primary (no sub-area chosen) has no new sub-area.
export function getAreaNovelty(parent, location, { syncedAreas = [], dynamicMap = {}, categoryMap = {}, parents = [] } = {}) {
  const parentName = String(parent ?? '').trim();
  const subName = String(location ?? '').trim();
  if (!parentName) return { newParent: false, newSub: false };
  const knownParents = uniqueNames([
    ...parents,
    ...syncedAreas.map((area) => area?.parent),
    ...Object.keys(categoryMap),
    ...Object.keys(dynamicMap),
  ]);
  const newParent = !knownParents.some((name) => keyOf(name) === keyOf(parentName));
  const hasSub = subName && keyOf(subName) !== keyOf(parentName);
  const subs = collectSubAreas(parentName, { syncedAreas, dynamicMap, categoryMap });
  const newSub = Boolean(hasSub) && !subs.some((name) => keyOf(name) === keyOf(subName));
  return { newParent, newSub };
}

// A plot with no sub-area stores its Primary's name as its location. That is a storage convention,
// not a sub-area, so forms show the sub-area box as empty in that case.
export function displaySubArea(location, parent) {
  const sub = String(location ?? '').trim();
  return keyOf(sub) === keyOf(parent) ? '' : sub;
}
