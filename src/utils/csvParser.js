export function parseCSV(csvText) {
  if (!csvText) return []
  const lines = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      row.push(cell.trim())
      if (row.some(c => c !== '')) {
        lines.push(row)
      }
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell.trim())
    if (row.some(c => c !== '')) {
      lines.push(row)
    }
  }

  if (lines.length < 2) return []

  const headers = lines[0].map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ''))
  const results = []

  for (let r = 1; r < lines.length; r++) {
    const values = lines[r]
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? ''
    })
    results.push(obj)
  }

  return results
}
