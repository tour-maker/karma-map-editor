export const CATEGORY_MAP = {
  'Surat': [
    'Adajan', 'Vesu', 'Dumas', 'Gavier', 'Bhimrad', 'Magdalla', 'Piplod',
    'Bhatar', 'Althan', 'New Althan', 'Rundh', 'Umra', 'Parle Point', 'Athwalines',
    'Ghod Dod Road', 'City Light', 'New City light', 'Saroli', 'Sarsana', 'Abhva'
  ],
  'Sandalpore': [],
  'NH 48 , Palsana': [],
  'Navsari': [],
  'Valsad': [],
  'Vapi': [],
  'Kosamba': [],
  'Kachholi': [],
  'Surat Vyara Highway': [],
  'Jhagadia GIDC': [],
  'Bilimora': [],
  'Panoli': [],
  'Delvada': []
};

// The category list is shared with the server (admins can add and rename categories), so these are
// live objects: setCategories() updates them in place and every importer sees the change.
export const PROPERTY_TYPES = [
  'Residential',
  'Commercial',
  'Freehold',
  'Industrial',
  'Agriculture',
  'Ready Farmhouse',
  'Rented'
];

export const PROPERTY_TYPE_COLORS = {
  'Residential': '#38bdf8',
  'Commercial': '#f97316',
  'Freehold': '#facc15',
  'Industrial': '#a855f7',
  'Agriculture': '#22c55e',
  'Ready Farmhouse': '#ec4899',
  // Rented / lease land gets its own colour, distinct from every other category.
  'Rented': '#ef4444',
};

// Earlier names of renamed categories: lower-cased old name -> current name.
export const CATEGORY_ALIASES = {};

export const DEFAULT_PROPERTY_COLOR = '#38bdf8';

// Replaces the category list with the one from the server. `list` is [{ name, color, aliases }].
// An empty or malformed list is ignored, so a failed load never leaves the app without categories.
export function setCategories(list) {
  const valid = (Array.isArray(list) ? list : []).filter(c => c && String(c.name || '').trim());
  if (valid.length === 0) return false;
  PROPERTY_TYPES.length = 0;
  Object.keys(PROPERTY_TYPE_COLORS).forEach(key => delete PROPERTY_TYPE_COLORS[key]);
  Object.keys(CATEGORY_ALIASES).forEach(key => delete CATEGORY_ALIASES[key]);
  valid.forEach(({ name, color, aliases }) => {
    const clean = String(name).trim();
    PROPERTY_TYPES.push(clean);
    PROPERTY_TYPE_COLORS[clean] = /^#[0-9a-f]{6}$/i.test(color || '') ? color : DEFAULT_PROPERTY_COLOR;
    (aliases || []).forEach(alias => { CATEGORY_ALIASES[String(alias).trim().toLowerCase()] = clean; });
  });
  return true;
}

// A built-in category name, followed through renames: "Freehold" -> "Free Zone" if it was renamed.
function currentName(name) {
  if (PROPERTY_TYPES.includes(name)) return name;
  return CATEGORY_ALIASES[String(name).toLowerCase()] || null;
}

// Category options that don't apply to a given area unit are hidden from the filter.
const CATEGORIES_HIDDEN_FOR_YARDS = ['Industrial', 'Agriculture', 'Ready Farmhouse'];
const CATEGORIES_HIDDEN_FOR_WINGHA = ['Commercial', 'Industrial'];

export function getCategoryOptionsForUnit(areaUnit) {
  const hide = (names) => PROPERTY_TYPES.filter(t => !names.some(n => currentName(n) === t));
  if (areaUnit === 'yards') return hide(CATEGORIES_HIDDEN_FOR_YARDS);
  if (areaUnit === 'wingha') return hide(CATEGORIES_HIDDEN_FOR_WINGHA);
  return PROPERTY_TYPES;
}

export function normalizePropertyType(rawType) {
  if (!rawType) return '';
  const lower = String(rawType).trim().toLowerCase();

  // An exact category name, or an earlier name of a renamed category, always wins.
  const exact = PROPERTY_TYPES.find(t => t.toLowerCase() === lower);
  if (exact) return exact;
  if (CATEGORY_ALIASES[lower]) return CATEGORY_ALIASES[lower];

  // Loose spellings ("Resi", "Farm house", "Available for rent"...) map to the built-in categories.
  // Rented / lease land uses a whole-word match so "parent" or "current" are never mistaken for it.
  const rules = [
    [/\b(rent(ed|al)?|lease(hold|d)?)\b/.test(lower), 'Rented'],
    [lower.includes('ready') || lower.includes('farmhouse'), 'Ready Farmhouse'],
    [lower.includes('agri') || lower.includes('farm'), 'Agriculture'],
    [lower.includes('resi') || lower === 'residence', 'Residential'],
    [lower.includes('commer'), 'Commercial'],
    [lower.includes('freehold') || lower.includes('freezone'), 'Freehold'],
    [lower.includes('indust'), 'Industrial'],
  ];
  for (const [matches, builtIn] of rules) {
    if (!matches) continue;
    const name = currentName(builtIn);
    if (name) return name;
  }

  const match = PROPERTY_TYPES.find(t => lower.includes(t.toLowerCase()));
  return match || rawType;
}

export function getPropertyTypeColor(rawType) {
  if (!rawType) return DEFAULT_PROPERTY_COLOR;
  const normalized = normalizePropertyType(rawType);
  if (PROPERTY_TYPE_COLORS[normalized]) return PROPERTY_TYPE_COLORS[normalized];
  if (PROPERTY_TYPE_COLORS[rawType]) return PROPERTY_TYPE_COLORS[rawType];

  const customPalette = ['#38bdf8', '#f97316', '#facc15', '#a855f7', '#22c55e', '#ec4899', '#06b6d4', '#10b981', '#6366f1', '#f43f5e'];
  let hash = 0;
  for (let i = 0; i < rawType.length; i++) {
    hash = rawType.charCodeAt(i) + ((hash << 5) - hash);
  }
  return customPalette[Math.abs(hash) % customPalette.length];
}

// Normalizes casing so variants like "kuched", "KUCHED", "kUcHeD" collapse to "Kuched".
export function normalizeLocationCase(str) {
  if (!str) return '';
  return String(str).trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export function determineParentLocation(location) {
  if (!location) return 'Surat';
  const locStr = normalizeLocationCase(location);
  const locLower = locStr.toLowerCase();

  // Only the known Surat sub-locations map to parent "Surat".
  if (locLower === 'surat') return 'Surat';
  if (CATEGORY_MAP['Surat'].some(sub => sub.toLowerCase() === locLower)) {
    return 'Surat';
  }

  // Everything else: parent location is the location itself.
  return locStr;
}

// Builds the live Location <-> Category matrix straight from real feature data —
// no per-location config, so it stays correct as properties are added, removed or
// recategorized. Two lookups come out of it:
//  - byLocation: every location string that can be selected (both a primary/parent
//    location AND each of its specific sub-locations) -> the set of categories
//    actually present there.
//  - byCategory: each category -> the set of PRIMARY (parent) locations that have
//    at least one property in that category. Kept at the primary level because
//    that's the granularity the Location dropdown itself lists.
export function buildLocationCategoryMatrix(features = []) {
  const byLocation = {};
  const byCategory = {};

  const addTo = (map, key, value) => {
    if (!key || !value) return;
    if (!map[key]) map[key] = new Set();
    map[key].add(value);
  };

  features.forEach(f => {
    if (f.id?.startsWith('landmark-') || f.data?.type === 'Landmark') return;
    if (f.style?.visible === false) return;

    const loc = f.data?.location;
    if (!loc) return;
    const parent = f.data?.parentLocation || f.data?.parent_location || determineParentLocation(loc);
    const category = normalizePropertyType(f.data?.type);
    if (!category) return;

    addTo(byLocation, loc, category);
    addTo(byLocation, parent, category);
    addTo(byCategory, category, parent);
  });

  return { byLocation, byCategory };
}

// null return means "no restriction" (nothing selected yet); an array (possibly
// empty) means only those values should be offered.
export function getCategoriesForLocation(matrix, location) {
  if (!location) return null;
  return matrix.byLocation[location] ? Array.from(matrix.byLocation[location]) : [];
}

export function getLocationsForCategory(matrix, category) {
  if (!category) return null;
  return matrix.byCategory[category] ? Array.from(matrix.byCategory[category]) : [];
}

// Builds a live { parent: [subs...] } map from actual feature data, instead of
// the static CATEGORY_MAP. A location only appears as a "sub" of a parent when
// it's textually different from the parent (self-mapped parents have no subs).
// A "property" is a real drawn polygon. Landmarks (map pins) are not properties.
export function isPropertyPolygon(f) {
  return Boolean(
    f &&
    f.type === 'polygon' &&
    Array.isArray(f.coordinates) && f.coordinates.length >= 3 &&
    !(f.id?.startsWith('landmark-') || f.data?.type === 'Landmark')
  );
}

export function buildDynamicLocationMap(features = []) {
  const categoryMap = {};

  features.forEach(f => {
    if (!isPropertyPolygon(f)) return;

    const loc = f.data?.location;
    if (!loc) return;

    const parent = f.data?.parentLocation || f.data?.parent_location || determineParentLocation(loc);
    if (!categoryMap[parent]) categoryMap[parent] = new Set();
    if (loc.toLowerCase() !== parent.toLowerCase()) {
      categoryMap[parent].add(loc);
    }
  });

  const finalMap = {};
  const sortedKeys = Object.keys(categoryMap).sort((a, b) => {
    if (a.toLowerCase() === 'surat') return -1;
    if (b.toLowerCase() === 'surat') return 1;
    return a.localeCompare(b);
  });
  sortedKeys.forEach(parent => {
    finalMap[parent] = Array.from(categoryMap[parent]).sort();
  });

  return finalMap;
}


