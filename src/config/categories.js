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

export const PROPERTY_TYPES = [
  'Residential',
  'Commercial',
  'Freehold',
  'Industrial',
  'Agriculture',
  'Ready Farmhouse'
];

export const PROPERTY_TYPE_COLORS = {
  'Residential': '#38bdf8',
  'Commercial': '#f97316',
  'Freehold': '#facc15',
  'Industrial': '#a855f7',
  'Agriculture': '#22c55e',
  'Ready Farmhouse': '#ec4899',
};

export const DEFAULT_PROPERTY_COLOR = '#38bdf8';

export function normalizePropertyType(rawType) {
  if (!rawType) return '';
  const lower = String(rawType).trim().toLowerCase();

  if (lower.includes('ready') || lower.includes('farmhouse')) return 'Ready Farmhouse';
  if (lower.includes('agri') || lower.includes('farm')) return 'Agriculture';
  if (lower.includes('resi') || lower === 'residence') return 'Residential';
  if (lower.includes('commer')) return 'Commercial';
  if (lower.includes('freehold') || lower.includes('freezone')) return 'Freehold';
  if (lower.includes('indust')) return 'Industrial';

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

// Builds a live { parent: [subs...] } map from actual feature data, instead of
// the static CATEGORY_MAP. A location only appears as a "sub" of a parent when
// it's textually different from the parent (self-mapped parents have no subs).
export function buildDynamicLocationMap(features = []) {
  const categoryMap = {};

  features.forEach(f => {
    if (f.id?.startsWith('landmark-') || f.data?.type === 'Landmark') return;

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


