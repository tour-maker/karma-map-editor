// Display helpers for the admin Users panel "details" card.

export function getUserDisplayName(user = {}) {
  const full = [user.firstName, user.lastName].map(v => String(v || '').trim()).filter(Boolean).join(' ');
  return full || '';
}

// Counts non-empty values, keeping the first spelling of each name (case-insensitive),
// most frequent first. Used for "property types" and "areas" chips.
export function countValues(values = []) {
  const map = new Map();
  values.forEach(raw => {
    const name = String(raw || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    const entry = map.get(key);
    if (entry) entry.count += 1;
    else map.set(key, { name, count: 1 });
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
