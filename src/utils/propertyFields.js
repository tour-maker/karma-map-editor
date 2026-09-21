// A field counts as "empty" only when it is null/undefined, blank after trimming, or exactly "-".
// Anything else (including 0 and numeric values) is real data and must always be shown.
export function isMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text !== '' && text !== '-';
}

// Resolves TP/OP/FP for display. The stored column value wins when it is real; when it is
// empty or a "-" placeholder we fall back to a value embedded in the polygon name
// (e.g. "TP 7 OP 12 FP 47"), so real data is never dropped just because its column holds a dash.
// (?![A-Za-z]) stops "OP" matching inside words such as "opp." or "shop".
export function resolveTpOpFp({ tp, op, fp, name } = {}) {
  const resolved = {};
  for (const [key, value] of [['tp', tp], ['op', op], ['fp', fp]]) {
    if (isMeaningfulValue(value)) {
      resolved[key] = String(value).trim();
      continue;
    }
    if (name) {
      const match = String(name).match(new RegExp(`\\b${key}(?![A-Za-z])[:\\s]*([A-Z0-9/]+)`, 'i'));
      if (match) resolved[key] = match[1];
    }
  }
  return resolved;
}
