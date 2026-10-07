import { API_BASE_URL } from '../config/api';

// Where each currently-unassigned plot came from. `events` are newest first (as the API returns
// them); the newest delete event that mentions a plot is the one that put it there.
export function findPlotOrigins(events = [], plotIds = []) {
  const wanted = new Set(plotIds);
  const origins = new Map();
  for (const event of events) {
    if (event?.action !== 'delete-area' && event?.action !== 'delete-sub') continue;
    for (const plot of event.plots || []) {
      if (!wanted.has(plot.id) || origins.has(plot.id)) continue;
      origins.set(plot.id, {
        fromParent: plot.fromParent || '',
        fromLocation: plot.fromLocation || '',
        deletedArea: event.area || '',
        at: event.createdAt || null,
        by: event.by || 'admin'
      });
    }
  }
  return origins;
}

// "Surat > Adajan" / "Surat" - the place a plot used to live.
export function describeOrigin(origin) {
  if (!origin) return '';
  const parent = String(origin.fromParent || '').trim();
  const location = String(origin.fromLocation || '').trim();
  if (parent && location && location.toLowerCase() !== parent.toLowerCase()) return `${parent} > ${location}`;
  return parent || location;
}

const adminHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${sessionStorage.getItem('karmaAdminJWT')}`
});

// Fire-and-forget: the audit trail must never block or fail an area change.
export async function logAreaEvent(event) {
  try {
    await fetch(`${API_BASE_URL}/api/area-events`, { method: 'POST', headers: adminHeaders(), body: JSON.stringify(event) });
  } catch (error) {
    console.warn('Could not record the area change:', error);
  }
}

export async function fetchAreaEvents(actions = ['delete-area', 'delete-sub']) {
  const res = await fetch(`${API_BASE_URL}/api/area-events?actions=${encodeURIComponent(actions.join(','))}`, { headers: adminHeaders() });
  if (!res.ok) throw new Error('Could not load the area history');
  return res.json();
}
