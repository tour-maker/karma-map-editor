import { useState, useEffect } from 'react';
import { FiX, FiClock, FiCheckCircle, FiXCircle, FiLogOut, FiUser, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useMapStore } from '../../store/useMapStore';
import { useGoogleMap } from '../../context/GoogleMapContext';
import { API_BASE_URL } from '../../config/api';
import { glassPanelStyle, GLASS_COLORS, GLASS_RADIUS, GOLD_GRADIENT, GLASS_FONT } from '../../styles/glass';

const STATUS_META = {
  pending: { label: 'Pending Review', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', Icon: FiClock },
  approved: { label: 'Approved', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)', Icon: FiCheckCircle },
  rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', Icon: FiXCircle }
};

const SUMMARY_TILES = [
  { key: 'pending', label: 'Pending', Icon: FiClock, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)' },
  { key: 'approved', label: 'Approved', Icon: FiCheckCircle, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.3)' },
  { key: 'rejected', label: 'Rejected', Icon: FiXCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.3)' }
];

export default function MyRequestsPanel({ onClose }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);
  const map = useGoogleMap();

  const viewerUsername = useMapStore(state => state.viewerUsername);
  const setViewerUsername = useMapStore(state => state.setViewerUsername);
  const setPreviewSubmission = useMapStore(state => state.setPreviewSubmission);
  const setMyRequestsSubmissions = useMapStore(state => state.setMyRequestsSubmissions);
  const setMyRequestsStatusFilter = useMapStore(state => state.setMyRequestsStatusFilter);

  useEffect(() => {
    fetchMine();
    // Clear the map overlay when the panel closes, so it doesn't linger indefinitely
    return () => {
      setMyRequestsSubmissions([]);
      setMyRequestsStatusFilter(null);
    };
  }, [setMyRequestsSubmissions, setMyRequestsStatusFilter]);

  // Keep the map's overlay of submission polygons in sync with the panel's own list/filter
  useEffect(() => {
    setMyRequestsSubmissions(submissions);
  }, [submissions, setMyRequestsSubmissions]);

  useEffect(() => {
    setMyRequestsStatusFilter(statusFilter);
  }, [statusFilter, setMyRequestsStatusFilter]);

  const fetchMine = async () => {
    setLoading(true);
    try {
      const jwt = localStorage.getItem('karmaUserJWT');
      const res = await fetch(`${API_BASE_URL}/api/submissions/mine`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      if (res.ok) {
        setSubmissions(await res.json());
      } else if (res.status === 401) {
        toast.error('Your session expired — please sign in again.');
        handleLogout();
      }
    } catch (error) {
      console.error('Fetch my submissions error:', error);
      toast.error('Cannot reach server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('karmaUserJWT');
    setViewerUsername(null);
    setPreviewSubmission(null);
    setMyRequestsSubmissions([]);
    setMyRequestsStatusFilter(null);
    onClose?.();
  };

  const handleDeleteSubmission = async (e, sub) => {
    e.stopPropagation();
    if (!window.confirm('Permanently delete this rejected request?')) return;
    try {
      const jwt = localStorage.getItem('karmaUserJWT');
      const res = await fetch(`${API_BASE_URL}/api/submissions/${sub._id}/mine`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      if (res.ok) {
        setSubmissions(prev => prev.filter(s => s._id !== sub._id));
        toast.success('Request deleted');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete request');
      }
    } catch (error) {
      console.error('Delete submission error:', error);
      toast.error('Cannot reach server. Make sure the backend is running.');
    }
  };

  const handleSubmissionClick = (sub) => {
    setPreviewSubmission(sub);
    if (map && sub.coordinates && sub.coordinates.length > 0 && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      sub.coordinates.forEach(c => {
        if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
          bounds.extend(new window.google.maps.LatLng(c.lat, c.lng));
        }
      });
      if (!bounds.isEmpty()) {
        map.panTo(bounds.getCenter());
        map.setZoom(16);
      }
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(10, 14, 23, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        ...glassPanelStyle,
        width: '100%', maxWidth: 440, maxHeight: '85vh',
        color: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: GLASS_RADIUS.control, boxSizing: 'border-box',
              background: GOLD_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: GLASS_RADIUS.control - 2, background: '#111827',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <FiUser size={15} color="#FDB713" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 17, ...GLASS_FONT.serif }}>My Requests</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Signed in as {viewerUsername}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <FiX size={20} />
          </button>
        </div>

        {!loading && submissions.length > 0 && (
          <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SUMMARY_TILES.map(tile => {
              const count = submissions.filter(s => (s.status || 'pending') === tile.key).length;
              const { Icon } = tile;
              const isActive = statusFilter === tile.key;
              return (
                <div
                  key={tile.key}
                  onClick={() => setStatusFilter(isActive ? null : tile.key)}
                  title={isActive ? `Showing ${tile.label} only — click to clear` : `Show ${tile.label} only`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    background: tile.bg, border: `1px solid ${isActive ? tile.color : tile.border}`,
                    boxShadow: isActive ? `0 0 0 1px ${tile.color}` : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: tile.color }}>
                    <Icon size={14} /> {tile.label}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ color: '#94a3b8', padding: 20, textAlign: 'center' }}>Loading your requests...</div>
          ) : submissions.length === 0 ? (
            <div style={{ color: '#94a3b8', padding: 20, textAlign: 'center', fontSize: 13 }}>
              You haven't submitted any property requests yet. Draw a polygon on the map to get started.
            </div>
          ) : statusFilter && submissions.filter(s => (s.status || 'pending') === statusFilter).length === 0 ? (
            <div style={{ color: '#94a3b8', padding: 20, textAlign: 'center', fontSize: 13 }}>
              No {STATUS_META[statusFilter]?.label.toLowerCase() || statusFilter} requests.
            </div>
          ) : (
            (statusFilter ? submissions.filter(s => (s.status || 'pending') === statusFilter) : submissions).map(sub => {
              const meta = STATUS_META[sub.status] || STATUS_META.pending;
              const { Icon } = meta;
              return (
                <div
                  key={sub._id}
                  onClick={() => handleSubmissionClick(sub)}
                  style={{
                    background: 'rgba(255,255,255,0.04)', borderRadius: GLASS_RADIUS.control, padding: 14,
                    border: `1px solid ${GLASS_COLORS.border}`, cursor: 'pointer', transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700,
                      color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`,
                      padding: '3px 9px', borderRadius: 999
                    }}>
                      <Icon size={12} /> {meta.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#64748b', fontSize: 11.5 }}>{new Date(sub.createdAt).toLocaleDateString()}</span>
                      {sub.status === 'rejected' && (
                        <button
                          onClick={(e) => handleDeleteSubmission(e, sub)}
                          title="Delete this rejected request"
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: GLASS_RADIUS.control, color: '#f87171', cursor: 'pointer', padding: 4,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <FiTrash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0' }}>
                    <div><strong>Location:</strong> {sub.parentLocation || sub.location || 'N/A'} {sub.location && sub.parentLocation ? `(${sub.location})` : ''}</div>
                    <div><strong>Area:</strong> {sub.area || 'N/A'}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                      <span><strong>TP:</strong> {sub.tp || '-'}</span>
                      <span><strong>OP:</strong> {sub.op || '-'}</span>
                      <span><strong>FP:</strong> {sub.fp || '-'}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            <FiLogOut size={15} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
