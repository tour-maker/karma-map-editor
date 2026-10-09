import { useEffect, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config/api';

const authHeaders = () => {
  const jwt = sessionStorage.getItem('karmaAdminJWT');
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
};

/**
 * Admin button next to the Google Sheet icon. Only appears when the data lives in MongoDB
 * (the sheet is then an automatic copy). Click = rewrite the sheet from the database right now.
 */
export default function SheetSyncButton() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/sheets/sync-status`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(s => { if (!cancelled) setStatus(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (status?.storage !== 'mongo') return null;

  const sync = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/sheets/sync-all`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Google Sheet updated from the database');
        setStatus(s => ({ ...s, dirtyTabs: [], lastError: '' }));
      } else if (res.status !== 401) {
        toast.error(data.error || 'Could not update the Google Sheet');
      }
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setBusy(false);
    }
  };

  const pending = (status.dirtyTabs || []).length > 0 || !!status.lastError;
  return (
    <button
      type="button"
      onClick={sync}
      disabled={busy}
      title={pending
        ? `Sheet copy is behind${status.lastError ? ` (${status.lastError})` : ''} - click to update it now`
        : 'Sheet copy is up to date - click to refresh it now'}
      aria-label="Update Google Sheet from the database"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'wait' : 'pointer',
        color: pending ? '#f59e0b' : '#10b981', padding: 6, borderRadius: '50%', opacity: busy ? 0.5 : 1,
        background: pending ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.1)',
        border: `1px solid ${pending ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`
      }}
    >
      <FiRefreshCw size={14} />
    </button>
  );
}
