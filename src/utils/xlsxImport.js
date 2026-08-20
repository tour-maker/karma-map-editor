import * as XLSX from 'xlsx'
import { calculatePolygonCenter } from '../services/googleMaps'
import { normalizePropertyType, determineParentLocation } from '../config/categories.js'

export class XlsxImportError extends Error { }

const PROPERTY_HEADER_ALIASES = {
  propertyNumber: ['sr no.', 'sr no', 'srno.', 'srno', 'property number', 'id', 'block no'],
  googleMapLocation: ['google map location', 'map location', 'location (lat,lng)', 'gmap location', 'google pin'],
  isActive: ['is active', 'active'],
  areaSquareYards: ['area (square yards)', 'area (square yard)', 'area sq yd', 'area (sq yd)', 'area (sqyard)', 'area (vingha)', 'area', 'sub area', 'wingha/sqyd'],
  tp: ['tp', 'tp no.', 'tp no', 't.p.', 't.p', 't.p. no', 't.p. no.', 'tpno', 'tpschemeno', 'town planning', 'townplanning'],
  op: ['op', 'op/ block no.', 'op no.', 'op no', 'o.p.', 'o.p', 'o.p. no', 'o.p. no.', 'opno', 'plot no', 'plot no.', 'plotno', 'original plot', 'originalplot'],
  fp: ['fp', 'fp no.', 'fp no', 'f.p.', 'f.p', 'f.p. no', 'f.p. no.', 'fpno', 'final plot', 'finalplot'],
  location: ['location', 'moje/location', 'wad'],
  parentLocation: ['parent location', 'parent_location', 'parent category', 'main location'],
  landmark: ['landmark', 'through'],
  propertyType: ['type', 'property type', 'category'],
  remarks: ['remark', 'remarks']
}

const BOUNDARY_HEADER_ALIASES = {
  polygonNo: ['polygon no.', 'polygon no', 'polygon number'],
  polygonName: ['polygon name'],
  pointNo: ['point no.', 'point no', 'point number'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lng', 'long']
}

const SHEET_COLUMN_OVERRIDES = {
  vesu: { location: 'area', areaSquareYards: 'wad', landmark: 'sub area' },
  dumas: { location: 'area', areaSquareYards: 'wad', landmark: 'sub area' },
  palsana: { location: 'area', areaSquareYards: 'wingha/sqyd', landmark: 'sub area' },
  'kim kosamba': { location: 'area', areaSquareYards: 'wingha/sqyd', landmark: 'sub area' }
}

const SQYD_PER_VINGHA = 23.83 * 121

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isBlankRow(row) {
  return !row || row.every((cell) => cell === '' || cell == null)
}

export function parseAreaWithUnit(rawValue) {
  if (rawValue === '' || rawValue == null) {
    return null
  }

  const text = String(rawValue).trim().toLowerCase()
  if (!text) return null

  const isVingha = /wingha|vingha|vigha/.test(text)

  let numericText = text
    .replace(/sq\.?\s*yards?|sqyd|square\s*yards?|wingha|vingha|vigha/g, '')
    .trim()

  if (/^\d+-\d+$/.test(numericText)) {
    numericText = numericText.replace('-', '.')
  }

  const match = numericText.match(/-?\d+(\.\d+)?/)
  if (!match) return null

  const value = Number(match[0])
  if (!Number.isFinite(value)) return null

  return isVingha ? value * SQYD_PER_VINGHA : value
}

function toDisplayString(value) {
  return value == null ? '' : String(value).trim()
}

function toBooleanValue(value) {
  if (typeof value === 'boolean') {
    return value
  }
  if (value == null || value === '') {
    return true
  }

  const str = String(value).trim().toLowerCase()
  if (['y', 'yes', 'true', '1', 'active'].includes(str)) {
    return true
  }
  if (['n', 'no', 'false', '0', 'inactive'].includes(str)) {
    return false
  }
  return true
}

function parseLatLngPair(value) {
  if (!value) return null
  const parts = String(value).split(',')
  if (parts.length < 2) return null

  const lat = parseFloat(parts[0].trim())
  const lng = parseFloat(parts[1].trim())

  if (isNaN(lat) || isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return { lat, lng }
}

function parseHeaderIndices(headerRow, aliases) {
  const indices = {}
  const usedCols = new Set()

  Object.keys(aliases).forEach((field) => {
    indices[field] = -1
  })

  headerRow.forEach((cellValue, colIdx) => {
    const norm = normalizeHeader(cellValue)
    if (!norm) return

    Object.entries(aliases).forEach(([field, aliasList]) => {
      if (indices[field] !== -1) return

      if (aliasList.includes(norm)) {
        indices[field] = colIdx
        usedCols.add(colIdx)
      }
    })
  })

  return { indices, usedCols }
}

function findHeaderRowIndex(rows, aliases) {
  const minRequiredMatches = 2

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i]
    if (!row || isBlankRow(row)) continue

    const { indices } = parseHeaderIndices(row, aliases)
    const matchCount = Object.values(indices).filter((idx) => idx !== -1).length

    if (matchCount >= minRequiredMatches) {
      return i
    }
  }

  return -1
}

function buildExtendedData(row, headerRow, usedCols) {
  const extended = {}
  row.forEach((cellValue, colIdx) => {
    if (usedCols.has(colIdx)) return

    const header = toDisplayString(headerRow[colIdx])
    const val = toDisplayString(cellValue)

    if (header && val) {
      extended[header] = val
    }
  })
  return extended
}

export function parsePropertySheet(rows, sheetName) {
  const headerIdx = findHeaderRowIndex(rows, PROPERTY_HEADER_ALIASES)
  if (headerIdx === -1) {
    return { properties: [], warnings: [`Sheet "${sheetName}" has no recognizable header row.`] }
  }

  const headerRow = rows[headerIdx]
  const { indices: parsedIndices, usedCols } = parseHeaderIndices(headerRow, PROPERTY_HEADER_ALIASES)

  const normalizedSheet = sheetName.trim().toLowerCase()
  const overrides = SHEET_COLUMN_OVERRIDES[normalizedSheet] || {}
  const indices = { ...parsedIndices }
  if (Object.keys(overrides).length > 0) {
    const headerToCol = {}
    headerRow.forEach((cell, idx) => {
      const h = normalizeHeader(cell)
      if (h) headerToCol[h] = idx
    })
    Object.entries(overrides).forEach(([field, targetHeader]) => {
      const col = headerToCol[normalizeHeader(targetHeader)]
      if (col != null) {
        indices[field] = col
        usedCols.add(col)
      }
    })
  }

  const properties = []
  const warnings = []

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (isBlankRow(row)) continue

    const getVal = (field) => {
      const col = indices[field]
      if (col === -1 || col >= row.length) return undefined
      return row[col]
    }

    const rawPropertyNumber = getVal('propertyNumber')
    const rawLocation = getVal('location')
    const rawParentLocation = getVal('parentLocation')
    const rawMapLoc = getVal('googleMapLocation')
    const rawTp = getVal('tp')
    const rawOp = getVal('op')
    const rawFp = getVal('fp')

    const hasAnyContent = Boolean(
      toDisplayString(rawPropertyNumber) ||
      toDisplayString(rawLocation) ||
      toDisplayString(rawParentLocation) ||
      toDisplayString(rawMapLoc) ||
      toDisplayString(rawTp) ||
      toDisplayString(rawOp) ||
      toDisplayString(rawFp)
    )

    if (!hasAnyContent) {
      continue
    }

    const propertyNumber = toDisplayString(rawPropertyNumber)
    const position = parseLatLngPair(rawMapLoc)
    const area = parseAreaWithUnit(getVal('areaSquareYards'))
    const location = toDisplayString(rawLocation)
    const parentLocation = toDisplayString(rawParentLocation) || determineParentLocation(location) || determineParentLocation(sheetName)
    const landmark = toDisplayString(getVal('landmark'))
    const propertyType = normalizePropertyType(toDisplayString(getVal('propertyType')))
    const remarks = toDisplayString(getVal('remarks'))
    const isActive = toBooleanValue(getVal('isActive'))
    const extendedData = buildExtendedData(row, headerRow, usedCols)

    const tp = toDisplayString(rawTp)
    const op = toDisplayString(rawOp)
    const fp = toDisplayString(rawFp)

    properties.push({
      sheetName,
      rowIndex: r,
      propertyNumber,
      position,
      area,
      tp,
      op,
      fp,
      location,
      parentLocation,
      landmark,
      propertyType,
      remarks,
      isActive,
      extendedData
    })
  }

  return { properties, warnings }
}

export function parseBoundarySheet(rows, sheetName) {
  const headerIdx = findHeaderRowIndex(rows, BOUNDARY_HEADER_ALIASES)
  if (headerIdx === -1) {
    return { boundaries: [], warnings: [`Boundary sheet "${sheetName}" has no recognizable header.`] }
  }

  const headerRow = rows[headerIdx]
  const { indices } = parseHeaderIndices(headerRow, BOUNDARY_HEADER_ALIASES)

  const rawPoints = []
  const warnings = []

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (isBlankRow(row)) continue

    const getVal = (field) => {
      const col = indices[field]
      if (col === -1 || col >= row.length) return undefined
      return row[col]
    }

    const polygonNo = toDisplayString(getVal('polygonNo'))
    const polygonName = toDisplayString(getVal('polygonName'))
    const pointNoVal = getVal('pointNo')
    const latVal = getVal('latitude')
    const lngVal = getVal('longitude')

    const lat = typeof latVal === 'number' ? latVal : parseFloat(String(latVal ?? ''))
    const lng = typeof lngVal === 'number' ? lngVal : parseFloat(String(lngVal ?? ''))

    if (isNaN(lat) || isNaN(lng)) {
      continue
    }

    rawPoints.push({
      polygonNo: polygonNo || polygonName || '1',
      polygonName,
      pointNo: typeof pointNoVal === 'number' ? pointNoVal : parseInt(String(pointNoVal ?? '0'), 10) || 0,
      lat,
      lng
    })
  }

  const grouped = {}
  rawPoints.forEach((pt) => {
    const key = pt.polygonNo
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(pt)
  })

  const boundaries = []
  Object.entries(grouped).forEach(([polygonNo, pts]) => {
    pts.sort((a, b) => a.pointNo - b.pointNo)
    const coordinates = pts.map((p) => ({ lat: p.lat, lng: p.lng }))

    if (coordinates.length >= 3) {
      boundaries.push({
        polygonNo,
        polygonName: pts[0].polygonName,
        coordinates,
        center: calculatePolygonCenter(coordinates)
      })
    }
  })

  return { boundaries, warnings }
}

function isBoundarySheetName(name) {
  const lower = name.toLowerCase()
  return lower.includes('boundary') || lower.includes('coordinates') || lower.includes('polygon')
}

export function mergeSheets(propertySheets, boundarySheets) {
  const boundaryMap = new Map()
  boundarySheets.forEach((bSheet) => {
    bSheet.boundaries.forEach((b) => {
      boundaryMap.set(b.polygonNo, b)
      if (b.polygonName) {
        boundaryMap.set(b.polygonName.toLowerCase(), b)
      }
    })
  })

  const features = []
  const warnings = []
  let featureCounter = 0

  propertySheets.forEach((pSheet) => {
    pSheet.properties.forEach((prop) => {
      featureCounter++
      const matchedBoundary =
        boundaryMap.get(prop.propertyNumber) ||
        (prop.location ? boundaryMap.get(prop.location.toLowerCase()) : null)

      const id = `excel-${Date.now()}-${featureCounter}`
      const baseData = {
        name: prop.propertyNumber ? `Property ${prop.propertyNumber}` : (prop.location || `Excel Feature ${featureCounter}`),
        project: prop.sheetName,
        tp: prop.tp,
        op: prop.op,
        fp: prop.fp,
        area: prop.area,
        location: prop.location,
        parentLocation: prop.parentLocation,
        landmark: prop.landmark,
        type: prop.propertyType,
        remarks: prop.remarks,
        isActive: prop.isActive,
        extendedData: prop.extendedData
      }

      if (matchedBoundary) {
        features.push({
          id,
          source: 'excel',
          type: 'polygon',
          coordinates: matchedBoundary.coordinates,
          center: matchedBoundary.center,
          data: baseData,
          style: {
            fillColor: '#3b82f6',
            fillOpacity: 0.35,
            strokeColor: '#2563eb',
            strokeWeight: 2,
            visible: true
          }
        })
      } else if (prop.position) {
        features.push({
          id,
          source: 'excel',
          type: 'marker',
          position: prop.position,
          center: prop.position,
          data: baseData,
          style: {
            fillColor: '#3b82f6',
            strokeColor: '#2563eb',
            visible: true
          }
        })
      } else {
        features.push(
          generateSquarePolygon(prop, id, baseData)
        )
      }
    })
  })

  return { features, warnings }
}

export function generateSquarePolygon(prop, id, baseData) {
  const defaultCenter = { lat: 21.1702, lng: 72.8311 }

  const areaSqYards = prop.area != null && prop.area > 0 ? prop.area : 500
  const areaSqMeters = areaSqYards * 0.836127
  const sideMeters = Math.sqrt(areaSqMeters)

  const latOffset = sideMeters / (2 * 111320)
  const lngScale = Math.cos((defaultCenter.lat * Math.PI) / 180) || 1
  const lngOffset = sideMeters / (2 * 111320 * lngScale)

  const coordinates = [
    { lat: defaultCenter.lat + latOffset, lng: defaultCenter.lng - lngOffset },
    { lat: defaultCenter.lat + latOffset, lng: defaultCenter.lng + lngOffset },
    { lat: defaultCenter.lat - latOffset, lng: defaultCenter.lng + lngOffset },
    { lat: defaultCenter.lat - latOffset, lng: defaultCenter.lng - lngOffset }
  ]

  return {
    id,
    source: 'excel',
    type: 'polygon',
    coordinates,
    center: defaultCenter,
    data: baseData,
    style: {
      fillColor: '#3b82f6',
      fillOpacity: 0.35,
      strokeColor: '#2563eb',
      strokeWeight: 2,
      visible: true
    }
  }
}

export function parseXlsxWorkbook(arrayBuffer) {
  let workbook
  try {
    workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  } catch (err) {
    throw new XlsxImportError(`Failed to parse Excel workbook: ${err.message}`)
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new XlsxImportError('The Excel workbook contains no sheets.')
  }

  const propertySheets = []
  const boundarySheets = []
  const allWarnings = []

  workbook.SheetNames.forEach((sheetName) => {
    const ws = workbook.Sheets[sheetName]
    if (!ws) return

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    if (!rows || rows.length === 0) return

    if (isBoundarySheetName(sheetName)) {
      const res = parseBoundarySheet(rows, sheetName)
      boundarySheets.push(res)
      if (res.warnings) allWarnings.push(...res.warnings)
    } else {
      const res = parsePropertySheet(rows, sheetName)
      propertySheets.push(res)
      if (res.warnings) allWarnings.push(...res.warnings)
    }
  })

  const { features, warnings: mergeWarnings } = mergeSheets(propertySheets, boundarySheets)
  allWarnings.push(...mergeWarnings)

  if (features.length === 0) {
    throw new XlsxImportError('No valid properties or coordinates could be extracted from the Excel workbook.')
  }

  return {
    features,
    properties: features,
    unresolved: [],
    warnings: allWarnings
  }
}

export async function importXlsxFromFile(file) {
  if (!file) throw new XlsxImportError('No file provided.')

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const result = parseXlsxWorkbook(e.target.result)
        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new XlsxImportError('Failed to read file.'))
    reader.readAsArrayBuffer(file)
  })
}

export const importPropertiesFromFile = importXlsxFromFile;
export default importXlsxFromFile;
