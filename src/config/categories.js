export const CATEGORY_MAP = {
  'Surat': [
    'Adajan', 'Vesu', 'Pal', 'Nanpura', 'Dumas', 'Gavier', 'Bhimrad',
    'Magdalla', 'Piplod', 'Althan', 'Bhatar', 'Rander', 'Jahangirpura',
    'Katargam', 'Varachha', 'Sarthana', 'Udhna', 'Pandesara', 'Sachin',
    'Hazira', 'Ichchhapor', 'Bhesan', 'Palsana', 'Kamrej', 'Barbodhan'
  ],
  'Kosamba': [],
  'Tarsadi': [],
  'Kudsad': [],
  'Hathuran': [],
  'Kharach': [],
  'Navsari': [],
  'Lunsikui': [],
  'Jamalpore': [],
  'Vejalpore': [],
  'Chhapra': [],
  'Other': []
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

export function determineParentLocation(location) {
  if (!location) return '';
  const locStr = String(location).trim();

  for (const [parent, subs] of Object.entries(CATEGORY_MAP)) {
    if (locStr.toLowerCase() === parent.toLowerCase()) return parent;
    if (Array.isArray(subs) && subs.some(sub => sub.toLowerCase() === locStr.toLowerCase())) {
      return parent;
    }
  }

  const suratSubs = CATEGORY_MAP['Surat'] || ['Adajan', 'Vesu', 'Pal', 'Nanpura'];
  const isSurat = locStr.toLowerCase() === 'surat' ||
    locStr.toLowerCase().includes('surat') ||
    suratSubs.some(sub => sub.toLowerCase() === locStr.toLowerCase());

  if (isSurat) {
    return 'Surat';
  }
  return locStr;
}


