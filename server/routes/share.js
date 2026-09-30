import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { findPropertyById } from '../utils/sheetPropertyLookup.js';
import { isMeaningfulValue } from '../../src/utils/propertyFields.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// The public origin the share link and the OG image URL are built against.
const SITE_ORIGIN = (process.env.PUBLIC_SITE_ORIGIN || 'https://karmalandtour.360eye.tech').replace(/\/$/, '');
const GENERIC_TITLE = 'Karma Map Editor - Interactive Real Estate & Property Mapping Tool';
const GENERIC_DESCRIPTION = 'Interactive map editor for viewing, editing, matching, and managing real estate property polygons, landmarks, and spatial analytics.';
// .jpg, not .webp: WhatsApp's and several other link-unfurling crawlers have
// unreliable/no support for WebP in og:image, so a .webp preview can fail to
// render even though the tag itself is present and correct (confirmed via curl).
const GENERIC_IMAGE = `${SITE_ORIGIN}/preview.jpg`;
const GENERIC_IMAGE_TYPE = 'image/jpeg';

// Server-side key for the Maps Static API, used to render a real per-plot
// satellite screenshot for the link-preview image below. Separate from the
// frontend's VITE_GOOGLE_MAPS_API_KEY (that one ships in the client bundle
// and is restricted to browser/JS Maps use) — falls back to it only so this
// keeps working if just one key happens to be set with both APIs enabled,
// but the Google Cloud Console key restrictions should normally differ for
// a server-side key. Requires the "Maps Static API" to be enabled for
// whichever key is used.
const GOOGLE_STATIC_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Builds a satellite screenshot of the plot's exact polygon (path auto-fits
// the view, no manual center/zoom needed) instead of the one generic image
// every shared link previously showed. Returns null when there's no key
// configured or no usable polygon, so callers can fall back to GENERIC_IMAGE.
function buildPlotImageUrl(coordinates) {
  if (!GOOGLE_STATIC_MAPS_API_KEY) return null;
  if (!Array.isArray(coordinates) || coordinates.length < 3) return null;

  const pathPoints = coordinates.map(c => `${c.lat},${c.lng}`).join('|');
  // Same gold used for selected-polygon chrome elsewhere in the app
  // (activeColor '#f59e0b'), so the preview reads as "this app's" plot outline.
  const pathParam = `color:0xf59e0bff|weight:3|fillcolor:0xf59e0b4d|${pathPoints}`;

  const params = new URLSearchParams({
    size: '1200x630',
    maptype: 'satellite',
    format: 'jpg',
    key: GOOGLE_STATIC_MAPS_API_KEY,
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}&path=${encodeURIComponent(pathParam)}`;
}

// Prefer the built frontend's index.html (correct hashed asset tags) when this
// server is deployed alongside the frontend build; fall back to the repo's
// source template otherwise (dev, or the two are hosted separately).
const INDEX_HTML_CANDIDATES = [
  join(__dirname, '..', '..', 'dist', 'index.html'),
  join(__dirname, '..', '..', 'index.html'),
];

function loadIndexHtmlTemplate() {
  for (const path of INDEX_HTML_CANDIDATES) {
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  return null;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function buildTitleAndDescription(property) {
  if (!property) {
    return { title: GENERIC_TITLE, description: GENERIC_DESCRIPTION };
  }

  const areaUnit = isMeaningfulValue(property.areaUnit) ? property.areaUnit : 'sq. yard';
  const type = isMeaningfulValue(property.type) ? property.type : 'Land';
  const location = isMeaningfulValue(property.location) ? property.location : 'Surat';
  const parentLocation = isMeaningfulValue(property.parentLocation) ? property.parentLocation : '';

  const areaPart = isMeaningfulValue(property.area) ? `${property.area} ${areaUnit}` : '';
  const locationPart = parentLocation ? `${location}, ${parentLocation}` : location;

  const title = `${[areaPart, type].filter(Boolean).join(' ')} Plot - ${locationPart} | Karma Realtors`;

  const tpFp = [
    isMeaningfulValue(property.tp) ? `TP: ${property.tp}` : '',
    isMeaningfulValue(property.op) ? `OP: ${property.op}` : '',
    isMeaningfulValue(property.fp) ? `FP: ${property.fp}` : '',
  ].filter(Boolean).join(' | ');

  const descriptionParts = [
    tpFp,
    isMeaningfulValue(property.landmark) ? `Near ${property.landmark}` : '',
    isMeaningfulValue(property.remarks) ? property.remarks : '',
  ].filter(Boolean);

  const description = descriptionParts.length > 0
    ? descriptionParts.join(' - ')
    : GENERIC_DESCRIPTION;

  return { title, description };
}

// @route   GET /share/:id
// @desc    Serve the built index.html with property-specific Open Graph /
//          Twitter tags swapped in, so link previews (WhatsApp, etc.) show
//          real property details instead of the generic site-wide tags.
//          Real visitors get the same page (the script tag is untouched), so
//          they land on the actual app with this plot preselected - see the
//          /share/:id parsing in MapEditor.jsx. Works for any id already in
//          the sheet, nothing here is hardcoded per-property.
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  let title = GENERIC_TITLE;
  let description = GENERIC_DESCRIPTION;
  let ogImage = GENERIC_IMAGE;
  let ogImageType = GENERIC_IMAGE_TYPE;

  try {
    const property = await findPropertyById(id);
    ({ title, description } = buildTitleAndDescription(property));

    const plotImage = buildPlotImageUrl(property?.coordinates);
    if (plotImage) {
      ogImage = plotImage;
      ogImageType = 'image/jpeg';
    }
  } catch (error) {
    // Bad/old id, sheet unreachable, etc. — fall back to the generic tags
    // rather than failing the request.
    console.warn(`[share] Could not look up property "${id}" for link preview, using generic tags:`, error.message);
  }

  const template = loadIndexHtmlTemplate();
  if (!template) {
    console.warn('[share] Could not find dist/index.html or index.html (no build present?)');
    return res
      .status(200)
      .type('html')
      .send(`<!doctype html><html><head><title>${escapeHtml(title)}</title></head><body>${escapeHtml(title)}</body></html>`);
  }

  const shareUrl = `${SITE_ORIGIN}/share/${encodeURIComponent(id)}`;
  const escTitle = escapeHtml(title);
  const escDescription = escapeHtml(description);

  // Strip the generic OG/Twitter block already in the template, then inject the
  // property-specific tags, so tags are never duplicated regardless of exactly
  // which meta tags the template currently ships with.
  let html = template
    .replace(/<title>.*?<\/title>/s, `<title>${escTitle}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escDescription}$2`)
    .replace(/<meta property="og:[^>]*>\s*/g, '')
    .replace(/<meta name="twitter:[^>]*>\s*/g, '');

  const ogTags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Karma Realtors" />`,
    `<meta property="og:title" content="${escTitle}" />`,
    `<meta property="og:description" content="${escDescription}" />`,
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:image:type" content="${ogImageType}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:url" content="${shareUrl}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escTitle}" />`,
    `<meta name="twitter:description" content="${escDescription}" />`,
    `<meta name="twitter:image" content="${ogImage}" />`,
  ].join('\n    ');

  html = html.includes('<head>')
    ? html.replace('<head>', `<head>\n    ${ogTags}`)
    : html;

  res.type('html').send(html);
});

export default router;
