import re

with open('src/config/categories.js', 'r') as f:
    code = f.read()

target_map = r"""export const CATEGORY_MAP = \{
  'Surat': \[
    'Adajan', 'Vesu', 'Pal', 'Nanpura', 'Dumas', 'Gavier', 'Bhimrad',
    'Magdalla', 'Piplod', 'Althan', 'Bhatar', 'Rander', 'Jahangirpura',
    'Katargam', 'Varachha', 'Sarthana', 'Udhna', 'Pandesara', 'Sachin',
    'Hazira', 'Ichchhapor', 'Bhesan', 'Palsana', 'Kamrej', 'Barbodhan'
  \],
  'Kosamba': \[\],
  'Tarsadi': \[\],
  'Kudsad': \[\],
  'Hathuran': \[\],
  'Kharach': \[\],
  'Navsari': \[\],
  'Lunsikui': \[\],
  'Jamalpore': \[\],
  'Vejalpore': \[\],
  'Chhapra': \[\],
  'Other': \[\]
\};"""

repl_map = """export const CATEGORY_MAP = {
  'Surat': [
    'Adajan', 'Vesu', 'Pal', 'Nanpura', 'Dumas', 'Gavier', 'Bhimrad',
    'Magdalla', 'Piplod', 'Althan', 'Bhatar', 'Rander', 'Jahangirpura',
    'Katargam', 'Varachha', 'Sarthana', 'Udhna', 'Pandesara', 'Sachin',
    'Hazira', 'Ichchhapor', 'Bhesan', 'Palsana', 'Kamrej', 'Barbodhan',
    'Tarsadi', 'Kudsad', 'Hathuran', 'Kharach', 'Lunsikui', 'Jamalpore',
    'Vejalpore', 'Chhapra', 'Other'
  ],
  'Sandalpore': [],
  'NH 48 , Palsana': [],
  'Navsari': [],
  'Valsad': [],
  'Vapi': [],
  'Kosamba': [],
  'Kachholi': [],
  'Surat Vyara Highway': [],
  'Jhagadia GIDC': []
};"""

code = re.sub(target_map, repl_map, code)

target_func = r"""export function determineParentLocation\(location\) \{
  if \(!location\) return '';
  const locStr = String\(location\)\.trim\(\);

  for \(const \[parent, subs\] of Object\.entries\(CATEGORY_MAP\)\) \{
    if \(locStr\.toLowerCase\(\) === parent\.toLowerCase\(\)\) return parent;
    if \(Array\.isArray\(subs\) && subs\.some\(sub => sub\.toLowerCase\(\) === locStr\.toLowerCase\(\)\)\) \{
      return parent;
    \}
  \}

  const suratSubs = CATEGORY_MAP\['Surat'\] \|\| \['Adajan', 'Vesu', 'Pal', 'Nanpura'\];
  const isSurat = locStr\.toLowerCase\(\) === 'surat' \|\|
    locStr\.toLowerCase\(\)\.includes\('surat'\) \|\|
    suratSubs\.some\(sub => sub\.toLowerCase\(\) === locStr\.toLowerCase\(\)\);

  if \(isSurat\) \{
    return 'Surat';
  \}
  return locStr;
\}"""

repl_func = """export function determineParentLocation(location) {
  if (!location) return 'Surat';
  const locStr = String(location).trim();

  // 1. Exact match with any top-level key first
  for (const [parent, subs] of Object.entries(CATEGORY_MAP)) {
    if (locStr.toLowerCase() === parent.toLowerCase()) return parent;
  }
  
  // 2. Exact match with any sub-location
  for (const [parent, subs] of Object.entries(CATEGORY_MAP)) {
    if (Array.isArray(subs) && subs.some(sub => sub.toLowerCase() === locStr.toLowerCase())) {
      return parent;
    }
  }

  // 3. Fallback: Anything unknown falls under Surat
  return 'Surat';
}"""

code = re.sub(target_func, repl_func, code)

with open('src/config/categories.js', 'w') as f:
    f.write(code)

with open('src/components/ui/FilterBar.jsx', 'r') as f:
    filter_code = f.read()

target_filter = r"""    features\.forEach\(f => \{
      const loc = f\.data\?\.location;
      if \(loc\) \{
        const primary = subLocationToPrimary\[loc\];
        if \(primary\) \{
          if \(!categoryMap\[primary\]\) categoryMap\[primary\] = new Set\(\);
          categoryMap\[primary\]\.add\(loc\);
        \} else \{
          if \(!categoryMap\[loc\]\) categoryMap\[loc\] = new Set\(\);
        \}
      \}
    \}\);"""

repl_filter = """    features.forEach(f => {
      const loc = f.data?.location;
      if (loc) {
        // Use determineParentLocation to dynamically enforce the exact same logic
        const primary = determineParentLocation(loc);
        if (!categoryMap[primary]) categoryMap[primary] = new Set();
        // Only add to the sub-locations set if it is NOT the exact primary location name
        if (loc.toLowerCase() !== primary.toLowerCase()) {
          categoryMap[primary].add(loc);
        }
      }
    });"""

filter_code = re.sub(target_filter, repl_filter, filter_code)

target_import = r"""import \{ CATEGORY_MAP \} from '\.\./\.\./config/categories';"""
repl_import = """import { CATEGORY_MAP, determineParentLocation } from '../../config/categories';"""
filter_code = re.sub(target_import, repl_import, filter_code)

with open('src/components/ui/FilterBar.jsx', 'w') as f:
    f.write(filter_code)

