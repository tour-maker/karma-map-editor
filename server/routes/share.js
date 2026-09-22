import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { findPropertyById } from '../utils/sheetPropertyLookup.js';
import { isMeaningfulValue } from '../../src/utils/propertyFields.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// The public origin the share link and the OG image URL are built against.
// Defaults to the app's current production origin (same one already hardcoded
// in index.html's generic og:url/og:image tags).
const PUBLIC_ORIGIN = (process.env.PUBLIC_SITE_ORIGIN || 'https://karma-map-editor.onrender.com').replace(/\/$/, '');

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

function buildOgTags({ title, description, image, url }) {
  return [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Karma Realtors" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ].join('\n    ');
}

function describeProperty(property) {
  const tpOpFpParts = [];
  if (isMeaningfulValue(property.tp)) tpOpFpParts.push(`TP: ${property.tp}`);
  if (isMeaningfulValue(property.op)) tpOpFpParts.push(`OP: ${property.op}`);
  if (isMeaningfulValue(property.fp)) tpOpFpParts.push(`FP: ${property.fp}`);

  const type = isMeaningfulValue(property.type) ? property.type : 'Property';
  const location = isMeaningfulValue(property.location)
    ? property.location
    : (isMeaningfulValue(property.parentLocation) ? property.parentLocation : 'Surat');

  const title = `${type} in ${location}${tpOpFpParts.length ? ' — ' + tpOpFpParts.join(' | ') : ''} | Karma Realtors`;

  const areaText = isMeaningfulValue(property.area)
    ? `${property.area} ${property.areaUnit && property.areaUnit.toLowerCase().includes('wingha') ? 'Wingha' : 'Sq Yard'}`
    : null;

  const descParts = [type, location];
  if (areaText) descParts.push(areaText);
  const description = `${descParts.join(' · ')}. View this plot's live location, category and details on the Karma Realtors interactive map.`;

  return { title, description };
}

// GET /share/:id — a plot-specific share link. Crawlers (WhatsApp, Facebook, etc.) see
// OG tags built from this property's CURRENT live sheet data; real visitors are sent on
// to the actual app with the plot preselected. Works for any id already in the sheet,
// including ones added after this route shipped — nothing here is hardcoded per-property.
router.get('/:id', async (req, res) => {
  const template = loadIndexHtmlTemplate();
  if (!template) {
    return res.redirect(302, `${PUBLIC_ORIGIN}/?feature=${encodeURIComponent(req.params.id)}`);
  }

  const appUrl = `${PUBLIC_ORIGIN}/?feature=${encodeURIComponent(req.params.id)}`;
  let property = null;
  try {
    property = await findPropertyById(req.params.id);
  } catch (err) {
    console.error('[share] Failed to look up property from sheet:', err.message);
  }

  // Unknown id: fall back to the generic homepage tags already baked into index.html —
  // just make sure a real visitor still lands on the app.
  if (!property) {
    const html = template.includes('<head>')
      ? template.replace('<head>', `<head>\n    <script>window.location.replace(${JSON.stringify(`${PUBLIC_ORIGIN}/`)});</script>`)
      : template;
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }

  const { title, description } = describeProperty(property);
  const image = `${PUBLIC_ORIGIN}/preview.webp`;
  const ogTags = buildOgTags({ title, description, image, url: appUrl });

  let html = template
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    // Strip the generic OG/Twitter block already in index.html so tags aren't duplicated
    .replace(/<meta property="og:[^>]*>\s*/g, '')
    .replace(/<meta name="twitter:[^>]*>\s*/g, '');

  html = html.includes('<head>')
    ? html.replace('<head>', `<head>\n    ${ogTags}\n    <script>window.location.replace(${JSON.stringify(appUrl)});</script>`)
    : html;

  res.set('Content-Type', 'text/html');
  res.send(html);
});

export default router;
