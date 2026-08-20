import { unzipSync } from 'fflate'
import { validateFeature } from './validation.js'
import { normalizePropertyType } from '../config/categories.js'

export class KmlImportError extends Error {}

function findByLocalName(parent, localName) {
  if (!parent) return []

  try {
    if (typeof parent.getElementsByTagNameNS === 'function') {
      const ns = Array.from(parent.getElementsByTagNameNS('*', localName))
      if (ns.length > 0) return ns
    }
  } catch {}

  try {
    const plain = Array.from(parent.getElementsByTagName(localName))
    if (plain.length > 0) return plain
  } catch {}

  try {
    return Array.from(parent.getElementsByTagName('*')).filter(
      (el) => el.localName === localName || el.nodeName === localName
    )
  } catch {
    return []
  }
}

function directChildText(element, tagName) {
  if (!element) return ''
  const child = Array.from(element.childNodes).find(
    (n) => n.nodeType === 1 && (n.localName === tagName || n.nodeName === tagName)
  )
  return child?.textContent?.trim() ?? ''
}

function anyChildText(element, tagName) {
  if (!element) return ''
  const direct = Array.from(element.childNodes).find(
    (n) => n.nodeType === 1 && (n.localName === tagName || n.nodeName === tagName)
  )
  if (direct) return direct.textContent?.trim() ?? ''
  const deep = findByLocalName(element, tagName)[0]
  return deep?.textContent?.trim() ?? ''
}

function parseKmlColor(kmlColorStr) {
  const raw = (kmlColorStr ?? '').trim()
  if (!/^[0-9a-fA-F]{8}$/.test(raw)) {
    return { color: '#3b82f6', opacity: 0.5 }
  }
  const a = parseInt(raw.slice(0, 2), 16) / 255
  const b = raw.slice(2, 4)
  const g = raw.slice(4, 6)
  const r = raw.slice(6, 8)
  return { color: `#${r}${g}${b}`, opacity: Math.round(a * 100) / 100 }
}

function parseLngLatAlt(tupleStr) {
  const parts = tupleStr.trim().split(',')
  if (parts.length < 2) return null
  const lng = parseFloat(parts[0])
  const lat = parseFloat(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function parseCoordinatesElement(coordsEl) {
  if (!coordsEl) return []
  const text = coordsEl.textContent ?? ''
  return text.trim().split(/\s+/).map(parseLngLatAlt).filter(Boolean)
}

let _idCounter = 0
function nextId(prefix = 'feat') {
  _idCounter += 1
  return `${prefix}-${Date.now()}-${_idCounter}`
}

export function parseStyle(kmlDoc, styleUrl) {
  const defaults = {
    strokeColor: '#3b82f6',
    strokeWeight: 2,
    fillColor: '#3b82f6',
    fillOpacity: 0.4
  }
  if (!styleUrl || !kmlDoc) return defaults
  const id = styleUrl.startsWith('#') ? styleUrl.slice(1) : styleUrl

  for (const styleMap of findByLocalName(kmlDoc, 'StyleMap')) {
    if (styleMap.getAttribute('id') === id) {
      for (const pair of findByLocalName(styleMap, 'Pair')) {
        const key = directChildText(pair, 'key')
        if (key === 'normal') {
          const styleUrlEl = findByLocalName(pair, 'styleUrl')[0]
          if (styleUrlEl) return parseStyle(kmlDoc, styleUrlEl.textContent.trim())
          const inlineStyle = findByLocalName(pair, 'Style')[0]
          if (inlineStyle) return extractStyleOptions(inlineStyle)
        }
      }
    }
  }

  for (const style of findByLocalName(kmlDoc, 'Style')) {
    if (style.getAttribute('id') === id) return extractStyleOptions(style)
  }

  return defaults
}

function extractStyleOptions(styleEl) {
  const result = { strokeColor: '#3b82f6', strokeWeight: 2, fillColor: '#3b82f6', fillOpacity: 0.4 }
  const lineStyle = findByLocalName(styleEl, 'LineStyle')[0]
  if (lineStyle) {
    const colorEl = findByLocalName(lineStyle, 'color')[0]
    if (colorEl) result.strokeColor = parseKmlColor(colorEl.textContent).color
    const widthEl = findByLocalName(lineStyle, 'width')[0]
    if (widthEl) {
      const w = parseFloat(widthEl.textContent)
      if (Number.isFinite(w)) result.strokeWeight = Math.max(1, Math.min(8, w))
    }
  }
  const polyStyle = findByLocalName(styleEl, 'PolyStyle')[0]
  if (polyStyle) {
    const colorEl = findByLocalName(polyStyle, 'color')[0]
    if (colorEl) {
      const { color, opacity } = parseKmlColor(colorEl.textContent)
      result.fillColor = color
      result.fillOpacity = opacity
    }
  }
  return result
}

export function parseExtendedData(placemarkEl) {
  const result = {}
  const extEl = findByLocalName(placemarkEl, 'ExtendedData')[0]
  if (extEl) {
    for (const dataEl of findByLocalName(extEl, 'Data')) {
      const name = dataEl.getAttribute('name')
      const value = findByLocalName(dataEl, 'value')[0]?.textContent?.trim() ?? ''
      if (name) result[name] = value
    }
    for (const simpleEl of findByLocalName(extEl, 'SimpleData')) {
      const name = simpleEl.getAttribute('name')
      if (name) result[name] = simpleEl.textContent?.trim() ?? ''
    }
  }

  const desc = anyChildText(placemarkEl, 'description');
  if (desc) {
    const trRegex = /<tr[^>]*>\s*<t[dh][^>]*>(.*?)<\/t[dh]>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/gi;
    let match;
    while ((match = trRegex.exec(desc)) !== null) {
      const key = match[1].replace(/<[^>]+>/g, '').trim();
      const value = match[2].replace(/<[^>]+>/g, '').trim();
      if (key && !result[key]) result[key] = value;
    }
    const liRegex = /<b[^>]*>(.*?)<\/b>:\s*(.*?)(?:<br|<\/li|$)/gi;
    while ((match = liRegex.exec(desc)) !== null) {
      const key = match[1].replace(/<[^>]+>/g, '').trim();
      const value = match[2].replace(/<[^>]+>/g, '').trim();
      if (key && !result[key]) result[key] = value;
    }

    const plainTextLines = desc.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    let fallbackRemarks = [];
    
    plainTextLines.forEach(line => {
      const lowerLine = line.toLowerCase();
      let matched = false;
      
      if (lowerLine.startsWith('tp') || lowerLine.startsWith('t.p')) {
        const val = line.replace(/^(tp|t\.p\.?)\s*:?\s*/i, '').trim();
        if (val) { result['tp'] = val; matched = true; }
      }
      else if (lowerLine.startsWith('op') || lowerLine.startsWith('o.p') || lowerLine.startsWith('plot no')) {
        const val = line.replace(/^(op|o\.p\.?|plot no\.?)\s*:?\s*/i, '').trim();
        if (val) { result['op'] = val; matched = true; }
      }
      else if (lowerLine.startsWith('fp') || lowerLine.startsWith('f.p')) {
        const val = line.replace(/^(fp|f\.p\.?)\s*:?\s*/i, '').trim();
        if (val) { result['fp'] = val; matched = true; }
      }
      
      const areaMatch = line.match(/^([\d.,]+)\s*(sqyd|sq\s*yds?|sq\s*yards?|sq\s*meters?|sqm|acre|guntha|wingha|vigha)/i);
      if (areaMatch) {
        const val = areaMatch[1].replace(/,/g, '');
        if (val) { result['area'] = val; matched = true; }
        
        const rest = line.substring(areaMatch[0].length).replace(/^[\s,]+/, '').trim();
        if (rest && !result['landmark']) {
          result['landmark'] = rest;
        }
      }
      else if (lowerLine.startsWith('opp.') || lowerLine.startsWith('near ') || lowerLine.startsWith('beside ')) {
        result['landmark'] = result['landmark'] ? result['landmark'] + ', ' + line : line;
        matched = true;
      }
      
      if (!matched && !Object.values(result).includes(line)) {
        fallbackRemarks.push(line);
      }
    });

    if (fallbackRemarks.length > 0 && !result['remarks']) {
      result['remarks'] = fallbackRemarks.join('\n');
    }
  }
  return result
}

function getExtendedValue(extendedData, ...keys) {
  if (!extendedData) return '';
  const normalizedKeys = keys.map(k => String(k).toLowerCase().replace(/[\.\s_:\-\(\)]/g, ''));
  for (const [k, v] of Object.entries(extendedData)) {
    const nk = String(k).toLowerCase().replace(/[\.\s_:\-\(\)]/g, '');
    if (normalizedKeys.includes(nk)) return String(v).trim();
  }
  return '';
}

function extractFieldFromString(str, ...aliases) {
  if (!str) return '';
  for (const alias of aliases) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:\\b|_|^)${escapedAlias}\\s*[:\\-]?\\s*([a-zA-Z0-9\\/]+)`, 'i');
    const match = str.match(regex);
    if (match) return match[1];
  }
  return '';
}

function extractNumber(val) {
  if (val == null || val === '') return null;
  const match = String(val).replace(/,/g, '').match(/[\d.]+/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

export function parsePolygon(placemarkEl, styleOptions, layerId, layerName) {
  const polygonEl = findByLocalName(placemarkEl, 'Polygon')[0]
  if (!polygonEl) return null
  const outerEl = findByLocalName(polygonEl, 'outerBoundaryIs')[0]
  if (!outerEl) return null
  const coordsEl = findByLocalName(outerEl, 'coordinates')[0]
  const coordinates = parseCoordinatesElement(coordsEl)
  if (coordinates.length < 3) return null

  const extendedData = parseExtendedData(placemarkEl)
  
  const latSum = coordinates.reduce((s, c) => s + c.lat, 0)
  const lngSum = coordinates.reduce((s, c) => s + c.lng, 0)
  const center = { lat: latSum / coordinates.length, lng: lngSum / coordinates.length }

  try {
    return validateFeature({
      id: nextId('poly'),
      source: 'kml',
      type: 'polygon',
      layerId,
      coordinates,
      center,
      style: {
        strokeColor: styleOptions.strokeColor,
        strokeWeight: styleOptions.strokeWeight,
        fillColor: styleOptions.fillColor,
        fillOpacity: styleOptions.fillOpacity,
        visible: true
      },
      data: {
        name: anyChildText(placemarkEl, 'name') || 'Unnamed Polygon',
        description: anyChildText(placemarkEl, 'description') || '',
        tp: getExtendedValue(extendedData, 'tp', 'townplanning', 'tpno', 'tpschemeno') || extractFieldFromString(anyChildText(placemarkEl, 'name'), 'tp no', 'tp.', 'tp') || extractFieldFromString(anyChildText(placemarkEl, 'description'), 'tp no', 'tp.', 'tp'),
        op: getExtendedValue(extendedData, 'op', 'originalplot', 'opno', 'plotno', 'blockno', 'srno') || extractFieldFromString(anyChildText(placemarkEl, 'name'), 'op no', 'op.', 'op') || extractFieldFromString(anyChildText(placemarkEl, 'description'), 'op no', 'op.', 'op'),
        fp: getExtendedValue(extendedData, 'fp', 'finalplot', 'fpno') || extractFieldFromString(anyChildText(placemarkEl, 'name'), 'fp no', 'fp.', 'fp') || extractFieldFromString(anyChildText(placemarkEl, 'description'), 'fp no', 'fp.', 'fp'),
        area: extractNumber(getExtendedValue(extendedData, 'area', 'areayards', 'areasquareyards', 'areasqyds', 'areasqyd')),
        location: getExtendedValue(extendedData, 'location', 'moje', 'village', 'wad'),
        landmark: getExtendedValue(extendedData, 'landmark', 'through', 'near', 'opp', 'beside'),
        type: normalizePropertyType(getExtendedValue(extendedData, 'type', 'propertytype', 'category', 'landuse')),
        remarks: getExtendedValue(extendedData, 'remarks', 'remark'),
        extendedData
      }
    })
  } catch (err) {
    console.warn(`Validation failed for KML polygon: ${err.message}`)
    return null
  }
}

export function parsePoint(placemarkEl, styleOptions, layerId, layerName) {
  const pointEl = findByLocalName(placemarkEl, 'Point')[0]
  if (!pointEl) return null
  const coordsEl = findByLocalName(pointEl, 'coordinates')[0]
  const coords = parseCoordinatesElement(coordsEl)
  if (coords.length === 0) return null
  
  const extendedData = parseExtendedData(placemarkEl)

  try {
    return validateFeature({
      id: nextId('pt'),
      source: 'kml',
      type: 'marker',
      layerId,
      position: coords[0],
      center: coords[0],
      style: {
        strokeColor: styleOptions.strokeColor,
        visible: true
      },
      data: {
        name: anyChildText(placemarkEl, 'name') || 'Unnamed Point',
        description: anyChildText(placemarkEl, 'description') || '',
        tp: getExtendedValue(extendedData, 'tp', 'townplanning', 'tpno', 'tpschemeno') || extractFieldFromString(anyChildText(placemarkEl, 'name'), 'tp no', 'tp.', 'tp') || extractFieldFromString(anyChildText(placemarkEl, 'description'), 'tp no', 'tp.', 'tp'),
        op: getExtendedValue(extendedData, 'op', 'originalplot', 'opno', 'plotno', 'blockno', 'srno') || extractFieldFromString(anyChildText(placemarkEl, 'name'), 'op no', 'op.', 'op') || extractFieldFromString(anyChildText(placemarkEl, 'description'), 'op no', 'op.', 'op'),
        fp: getExtendedValue(extendedData, 'fp', 'finalplot', 'fpno') || extractFieldFromString(anyChildText(placemarkEl, 'name'), 'fp no', 'fp.', 'fp') || extractFieldFromString(anyChildText(placemarkEl, 'description'), 'fp no', 'fp.', 'fp'),
        area: extractNumber(getExtendedValue(extendedData, 'area', 'areayards', 'areasquareyards', 'areasqyds', 'areasqyd')),
        location: getExtendedValue(extendedData, 'location', 'moje', 'village', 'wad'),
        landmark: getExtendedValue(extendedData, 'landmark', 'through', 'near', 'opp', 'beside'),
        type: normalizePropertyType(getExtendedValue(extendedData, 'type', 'propertytype', 'category', 'landuse')),
        remarks: getExtendedValue(extendedData, 'remarks', 'remark'),
        extendedData
      }
    })
  } catch (err) {
    console.warn(`Validation failed for KML point: ${err.message}`)
    return null
  }
}

export function parseMultiGeometry(placemarkEl, styleOptions, layerId, layerName) {
  const multiEl = findByLocalName(placemarkEl, 'MultiGeometry')[0]
  if (!multiEl) return { polygons: [], markers: [] }
  const baseName = anyChildText(placemarkEl, 'name') || 'Unnamed'
  const description = anyChildText(placemarkEl, 'description') || ''
  const extendedData = parseExtendedData(placemarkEl)
  const polygons = []
  const markers = []

  const polygonEls = findByLocalName(multiEl, 'Polygon')
  
  let totalLat = 0;
  let totalLng = 0;
  let totalPoints = 0;
  const allCoordsList = polygonEls.map(polygonEl => {
    const outerEl = findByLocalName(polygonEl, 'outerBoundaryIs')[0]
    if (!outerEl) return []
    const coordsEl = findByLocalName(outerEl, 'coordinates')[0]
    return parseCoordinatesElement(coordsEl)
  });

  allCoordsList.forEach(coords => {
    coords.forEach(c => {
      totalLat += c.lat;
      totalLng += c.lng;
      totalPoints++;
    });
  });
  
  const globalCenter = totalPoints > 0 ? { lat: totalLat / totalPoints, lng: totalLng / totalPoints } : null;

  polygonEls.forEach((polygonEl, idx) => {
    const coordinates = allCoordsList[idx];
    if (coordinates.length < 3) return
    
    try {
      polygons.push(validateFeature({
        id: nextId('poly'),
        source: 'kml',
        type: 'polygon',
        layerId,
        coordinates,
        center: globalCenter || { lat: coordinates[0].lat, lng: coordinates[0].lng },
        style: {
          strokeColor: styleOptions.strokeColor,
          strokeWeight: styleOptions.strokeWeight,
          fillColor: styleOptions.fillColor,
          fillOpacity: styleOptions.fillOpacity,
          visible: true
        },
        data: {
          name: polygonEls.length > 1 ? `${baseName} (${idx + 1})` : baseName,
          description,
          tp: getExtendedValue(extendedData, 'tp', 'townplanning', 'tpno', 'tpschemeno'),
          op: getExtendedValue(extendedData, 'op', 'originalplot', 'opno', 'plotno', 'blockno', 'srno'),
          fp: getExtendedValue(extendedData, 'fp', 'finalplot', 'fpno'),
          area: extractNumber(getExtendedValue(extendedData, 'area', 'areayards', 'areasquareyards', 'areasqyds', 'areasqyd')),
          location: getExtendedValue(extendedData, 'location', 'moje', 'village', 'wad'),
          landmark: getExtendedValue(extendedData, 'landmark', 'through', 'near', 'opp', 'beside'),
          type: normalizePropertyType(getExtendedValue(extendedData, 'type', 'propertytype', 'category', 'landuse')),
          remarks: getExtendedValue(extendedData, 'remarks', 'remark'),
          extendedData: {
            ...extendedData,
            hideCenterMarker: idx > 0
          }
        }
      }))
    } catch(err) { console.warn('Validation failed', err); }
  })

  if (polygons.length === 0) {
    findByLocalName(multiEl, 'Point').forEach((pointEl) => {
      const coordsEl = findByLocalName(pointEl, 'coordinates')[0]
      const coords = parseCoordinatesElement(coordsEl)
      if (coords.length === 0) return
      
      try {
        markers.push(validateFeature({
          id: nextId('pt'),
          source: 'kml',
          type: 'marker',
          layerId,
          position: coords[0],
          center: coords[0],
          style: {
            strokeColor: styleOptions.strokeColor,
            visible: true
          },
          data: {
            name: baseName,
            description,
            tp: getExtendedValue(extendedData, 'tp', 'townplanning', 'tpno', 'tpschemeno'),
            op: getExtendedValue(extendedData, 'op', 'originalplot', 'opno', 'plotno', 'blockno', 'srno'),
            fp: getExtendedValue(extendedData, 'fp', 'finalplot', 'fpno'),
            area: extractNumber(getExtendedValue(extendedData, 'area', 'areayards', 'areasquareyards', 'areasqyds', 'areasqyd')),
            location: getExtendedValue(extendedData, 'location', 'moje', 'village', 'wad'),
            landmark: getExtendedValue(extendedData, 'landmark', 'through', 'near', 'opp', 'beside'),
            type: normalizePropertyType(getExtendedValue(extendedData, 'type', 'propertytype', 'category', 'landuse')),
            remarks: getExtendedValue(extendedData, 'remarks', 'remark'),
            extendedData
          }
        }))
      } catch(err) { console.warn('Validation failed', err); }
    })
  }

  return { polygons, markers }
}

function processPlacemark(pm, kmlDoc, layerId, layerName, polygons, markers, warnings) {
  const styleUrl = anyChildText(pm, 'styleUrl')
  const styleOptions = parseStyle(kmlDoc, styleUrl)

  const hasMultiGeometry = findByLocalName(pm, 'MultiGeometry').length > 0
  const hasPolygon = findByLocalName(pm, 'Polygon').length > 0
  const hasPoint = findByLocalName(pm, 'Point').length > 0

  if (hasMultiGeometry) {
    const { polygons: p, markers: m } = parseMultiGeometry(pm, styleOptions, layerId, layerName)
    polygons.push(...p)
    markers.push(...m)
  } else if (hasPolygon) {
    const poly = parsePolygon(pm, styleOptions, layerId, layerName)
    if (poly) polygons.push(poly)
    else warnings.push(`Polygon "${anyChildText(pm, 'name') || '?'}" had invalid coordinates — skipped.`)
  } else if (hasPoint) {
    const marker = parsePoint(pm, styleOptions, layerId, layerName)
    if (marker) markers.push(marker)
    else warnings.push(`Point "${anyChildText(pm, 'name') || '?'}" had missing coordinates — skipped.`)
  }
}

export function parseFolders(rootEl, kmlDoc) {
  const layers = []
  const allPolygons = []
  const allMarkers = []
  const warnings = []

  const allPlacemarkEls = findByLocalName(rootEl, 'Placemark')

  if (allPlacemarkEls.length === 0) {
    return { layers, allPolygons, allMarkers, warnings }
  }

  const folderKeyMap = new WeakMap()
  for (const folderEl of findByLocalName(rootEl, 'Folder')) {
    folderKeyMap.set(folderEl, nextId('layer'))
  }

  const groups = new Map()
  for (const pm of allPlacemarkEls) {
    let ancestor = pm.parentElement
    let nearestFolder = null
    while (ancestor && ancestor !== rootEl && ancestor !== rootEl.ownerDocument?.documentElement) {
      if (ancestor.localName === 'Folder' || ancestor.nodeName === 'Folder') {
        nearestFolder = ancestor
        break
      }
      ancestor = ancestor.parentElement
    }

    const key = nearestFolder ? (folderKeyMap.get(nearestFolder) ?? 'default') : 'default'
    if (!groups.has(key)) groups.set(key, { folderEl: nearestFolder, placemarks: [] })
    groups.get(key).placemarks.push(pm)
  }

  for (const [key, { folderEl, placemarks }] of groups) {
    const layerId = key === 'default' ? nextId('layer') : key
    const layerName = folderEl
      ? directChildText(folderEl, 'name') || 'Unnamed Layer'
      : directChildText(rootEl, 'name') || 'Imported Layer'

    const polygons = []
    const markers = []

    for (const pm of placemarks) {
      processPlacemark(pm, kmlDoc, layerId, layerName, polygons, markers, warnings)
    }

    const finalMarkers = polygons.length > 0 ? [] : markers;

    const featureIds = [...polygons.map((p) => p.id), ...finalMarkers.map((m) => m.id)]
    if (featureIds.length > 0) {
      layers.push({ id: layerId, name: layerName, visible: true, featureIds })
      allPolygons.push(...polygons)
      allMarkers.push(...finalMarkers)
    }
  }

  return { layers, allPolygons, allMarkers, warnings }
}

export function parsePlacemarks(containerEl, kmlDoc, layerId, layerName) {
  const polygons = []
  const markers = []
  const warnings = []
  for (const pm of findByLocalName(containerEl, 'Placemark')) {
    processPlacemark(pm, kmlDoc, layerId, layerName, polygons, markers, warnings)
  }
  return { polygons, markers, warnings }
}

function tryParse(xmlText, mimeType) {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, mimeType)
    if (
      doc.documentElement?.localName === 'parsererror' ||
      doc.documentElement?.nodeName === 'parsererror' ||
      findByLocalName(doc, 'parsererror').length > 0
    ) {
      return null
    }
    return doc
  } catch {
    return null
  }
}

export function parseKml(xmlText) {
  const xmlDoc =
    tryParse(xmlText, 'application/xml') ??
    tryParse(xmlText, 'text/xml')

  if (!xmlDoc) {
    throw new KmlImportError('The file could not be parsed as XML. It may be malformed or not a KML file.')
  }

  const rootEl = xmlDoc.documentElement
  const documentEl = findByLocalName(xmlDoc, 'Document')[0] ?? rootEl

  if (!documentEl) {
    throw new KmlImportError('This file does not contain a KML Document element.')
  }

  const { layers, allPolygons, allMarkers, warnings } = parseFolders(documentEl, xmlDoc)

  if (allPolygons.length === 0 && allMarkers.length === 0) {
    const allPMs = findByLocalName(documentEl, 'Placemark').length
    const allLS = findByLocalName(documentEl, 'LineString').length
    const allFolders = findByLocalName(documentEl, 'Folder').length

    let hint = ''
    if (allPMs === 0 && allLS === 0 && allFolders === 0) {
      hint = ` The document appears empty or uses an unrecognised structure.`
    } else if (allPMs === 0 && allLS > 0) {
      hint = ` Found ${allLS} LineString(s) — only Polygons and Points are currently supported.`
    } else if (allPMs === 0) {
      hint = ` No <Placemark> elements were found (${allFolders} folder(s) present).`
    } else {
      hint = ` Found ${allPMs} Placemark(s) but none contained Polygon or Point geometry.`
    }

    throw new KmlImportError(`No supported features (Polygons, Points) were found.${hint}`)
  }

  return { layers, polygons: allPolygons, markers: allMarkers, warnings }
}

export function parseKmz(arrayBuffer) {
  let files
  try {
    files = unzipSync(new Uint8Array(arrayBuffer))
  } catch {
    throw new KmlImportError('Failed to unzip the KMZ file. It may be corrupted or not a valid ZIP archive.')
  }

  const entries = Object.entries(files)
  if (entries.length === 0) throw new KmlImportError('The KMZ archive is empty.')

  const kmlEntry =
    entries.find(([name]) => name.toLowerCase() === 'doc.kml') ??
    entries.find(([name]) => !name.includes('/') && name.toLowerCase().endsWith('.kml')) ??
    entries.find(([name]) => name.toLowerCase().endsWith('.kml'))

  if (!kmlEntry) throw new KmlImportError('No KML document found inside the KMZ archive.')

  try {
    return new TextDecoder('utf-8').decode(kmlEntry[1])
  } catch {
    throw new KmlImportError('Failed to decode the KML document inside the KMZ archive.')
  }
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new KmlImportError('Failed to read the selected file.'))
    reader.readAsArrayBuffer(file)
  })
}

function decodeXml(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(arrayBuffer)
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(arrayBuffer)
  }

  const text = new TextDecoder('utf-8').decode(arrayBuffer)
  return text.startsWith('\uFEFF') ? text.slice(1) : text
}

export async function importKmlFromFile(file) {
  if (!file) throw new KmlImportError('No file was selected.')

  const arrayBuffer = await readFileAsArrayBuffer(file)

  const header = new Uint8Array(arrayBuffer, 0, 4)
  const isZipByContent = header[0] === 0x50 && header[1] === 0x4B
  const isKmzByName =
    file.name.toLowerCase().endsWith('.kmz') ||
    file.type === 'application/vnd.google-earth.kmz'
  const isKmz = isKmzByName || isZipByContent

  const xmlText = isKmz ? parseKmz(arrayBuffer) : decodeXml(arrayBuffer)

  return parseKml(xmlText)
}

export default importKmlFromFile;
