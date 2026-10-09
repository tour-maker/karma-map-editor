// Parses the A1-notation ranges the app sends ("Polygons", "Polygons!A:S", "Polygons!A5:S5",
// "Polygons!S1", "'My Tab'!H2:H100") into plain numbers. Columns are 0-based, rows 1-based;
// null means "open ended".

function colIndex(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function quoteTitle(title) {
  return `'${String(title).replace(/'/g, "''")}'`;
}

export function parseA1(range) {
  const m = /^(?:'((?:[^']|'')+)'|([^!]+))(?:!(.*))?$/.exec(String(range || '').trim());
  if (!m) throw new Error(`Unable to parse range: ${range}`);
  const title = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2];
  const ref = m[3];
  const out = { title, startCol: 0, endCol: null, startRow: 1, endRow: null };
  if (!ref) return out;

  const parts = ref.split(':');
  if (parts.length > 2) throw new Error(`Unable to parse range: ${range}`);
  const parse = (p) => {
    const pm = /^([A-Za-z]*)(\d*)$/.exec(p);
    if (!pm || (!pm[1] && !pm[2])) throw new Error(`Unable to parse range: ${range}`);
    return { col: pm[1] ? colIndex(pm[1]) : null, row: pm[2] ? Number(pm[2]) : null };
  };
  const a = parse(parts[0]);
  const b = parts.length === 2 ? parse(parts[1]) : null;

  out.startCol = a.col ?? 0;
  out.startRow = a.row ?? 1;
  if (b) {
    out.endCol = b.col;
    out.endRow = b.row;
  } else {
    // A single cell ("S1") covers just that cell; a lone column/row reference is not valid here.
    out.endCol = a.col;
    out.endRow = a.row;
  }
  if (out.endRow !== null && out.endRow < out.startRow) throw new Error(`Unable to parse range: ${range}`);
  if (out.endCol !== null && out.endCol < out.startCol) throw new Error(`Unable to parse range: ${range}`);
  return out;
}
