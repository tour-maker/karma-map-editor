import { useState, useEffect } from 'react';
import { FiUsers, FiArrowLeft, FiTrash2, FiCheckCircle, FiClock, FiXCircle, FiLayers, FiEdit2, FiSave, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useMapStore } from '../store/useMapStore';
import { useGoogleMap } from '../context/GoogleMapContext';
import { API_BASE_URL } from '../config/api';
import { getCoordinatesCenter, SUBMISSION_FOCUS_ZOOM } from '../utils/submissionLocation';

const EDIT_FIELDS = [
  { key: 'tp', label: 'TP' },
  { key: 'op', label: 'OP' },
  { key: 'fp', label: 'FP' },
  { key: 'area', label: 'Area' },
  { key: 'areaUnit', label: 'Area Unit' },
  { key: 'location', label: 'Location' },
  { key: 'parentLocation', label: 'Parent Location' },
  { key: 'landmark', label: 'Landmark' },
  { key: 'type', label: 'Type' },
  { key: 'partyName', label: 'Party Name' },
  { key: 'partyPhone', label: 'Party Phone' },
  { key: 'brokerName', label: 'Broker Name' },
  { key: 'brokerPhone', label: 'Broker Phone' },
  { key: 'remarks', label: 'Remarks' },
];

// Admin-only panel: lists registered viewer accounts with per-user submission
// stats, and a drill-down into that user's actual properties — with full
// details plus inline edit/delete for each specific polygon they submitted.
export default function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null); // { _id, username, ... } or null
  const [userSubmissions, setUserSubmissions] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingSubId, setEditingSubId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState(null);
  const [deletingSubId, setDeletingSubId] = useState(null);

  const setIsAdminAuthenticated = useMapStore(state => state.setIsAdminAuthenticated);
  const map = useGoogleMap();

  // Clicking a user's property card takes the map to that polygon. Clicks on the card's own
  // buttons / inputs (Edit, Delete, the edit form) are ignored so they behave as before.
  const handleSubmissionCardClick = (event, sub) => {
    if (editingSubId === sub._id || event.target.closest('button, input, label, select, textarea')) return;
    const center = getCoordinatesCenter(sub.coordinates);
    if (!map || !center) return;
    map.panTo(center);
    map.setZoom(SUBMISSION_FOCUS_ZOOM);
  };

  // Shared wrapper for every admin-authenticated call in this panel: if the
  // token is missing/expired/invalid, the backend returns 401 — instead of
  // just showing an error toast and dead-ending, this signs the admin back
  // out so the login overlay reappears and a fresh token is minted on the
  // next sign-in, rather than leaving the panel stuck failing silently.
  const adminFetch = async (url, options = {}) => {
    const jwt = sessionStorage.getItem('karmaAdminJWT');
    const res = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), 'Authorization': `Bearer ${jwt}` }
    });
    if (res.status === 401) {
      sessionStorage.removeItem('karmaAdminJWT');
      setIsAdminAuthenticated(false);
      // The global admin-session guard (utils/adminSession.js) shows the calm notice.
    }
    return res;
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`${API_BASE_URL}/api/users`);
      if (res.ok) {
        setUsers(await res.json());
      } else if (res.status !== 401) {
        toast.error('Failed to load users');
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openUser = async (user) => {
    setSelectedUser(user);
    setDetailLoading(true);
    try {
      const res = await adminFetch(`${API_BASE_URL}/api/users/${user._id}/submissions`);
      if (res.ok) {
        setUserSubmissions(await res.json());
      } else if (res.status !== 401) {
        toast.error('Failed to load this user\'s properties');
      }
    } catch (error) {
      console.error('Failed to fetch user submissions:', error);
      toast.error('Failed to load this user\'s properties');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    setDeletingId(userId);
    try {
      const res = await adminFetch(`${API_BASE_URL}/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('User deleted');
        setUsers(prev => prev.filter(u => u._id !== userId));
        if (selectedUser?._id === userId) setSelectedUser(null);
      } else if (res.status !== 401) {
        toast.error('Failed to delete user');
      }
    } catch (error) {
      console.error('Delete user error:', error);
      toast.error('Error deleting user');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const startEditSubmission = (sub) => {
    setEditingSubId(sub._id);
    const initial = {};
    EDIT_FIELDS.forEach(({ key }) => { initial[key] = sub[key] || ''; });
    setEditForm(initial);
  };

  const saveEditSubmission = async (subId) => {
    setSavingEdit(true);
    try {
      const res = await adminFetch(`${API_BASE_URL}/api/submissions/${subId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        const { submission } = await res.json();
        setUserSubmissions(prev => prev.map(s => s._id === subId ? submission : s));
        toast.success('Property details updated');
        setEditingSubId(null);
      } else if (res.status !== 401) {
        toast.error('Failed to update property');
      }
    } catch (error) {
      console.error('Update property error:', error);
      toast.error('Error updating property');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteSubmission = async (subId) => {
    setDeletingSubId(subId);
    try {
      const res = await adminFetch(`${API_BASE_URL}/api/submissions/${subId}/permanent`, { method: 'DELETE' });
      if (res.ok) {
        setUserSubmissions(prev => prev.filter(s => s._id !== subId));
        setUsers(prev => prev.map(u => u._id === selectedUser?._id
          ? { ...u, totalProperties: u.totalProperties - 1 }
          : u
        ));
        toast.success('Property deleted');
      } else if (res.status !== 401) {
        toast.error('Failed to delete property');
      }
    } catch (error) {
      console.error('Delete property error:', error);
      toast.error('Error deleting property');
    } finally {
      setDeletingSubId(null);
      setConfirmDeleteSubId(null);
    }
  };

  // ── Detail view: one user's properties ──────────────────────────────────
  if (selectedUser) {
    return (
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => setSelectedUser(null)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <FiArrowLeft /> Back
          </button>
          <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{selectedUser.username}'s Properties</span>
        </div>

        {detailLoading ? (
          <div style={{ color: '#94a3b8', padding: 20 }}>Loading...</div>
        ) : userSubmissions.length === 0 ? (
          <div style={{ color: '#94a3b8', padding: 20 }}>This user hasn't submitted any properties.</div>
        ) : (
          userSubmissions.map(sub => {
            const isEditing = editingSubId === sub._id;
            return (
              <div
                key={sub._id}
                onClick={(event) => handleSubmissionCardClick(event, sub)}
                title={isEditing ? undefined : 'Click to show this polygon on the map'}
                style={{
                  background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16,
                  border: '1px solid rgba(255,255,255,0.1)', cursor: isEditing ? 'default' : 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{
                    fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px',
                    color: sub.status === 'approved' ? '#22c55e' : sub.status === 'rejected' ? '#ef4444' : '#f59e0b'
                  }}>
                    {sub.status}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 12 }}><FiClock /> {new Date(sub.createdAt).toLocaleDateString()}</span>
                </div>

                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {EDIT_FIELDS.map(({ key, label }) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <label style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>{label}</label>
                        <input
                          value={editForm[key] ?? ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                          style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 6, padding: '6px 8px', color: '#f1f5f9', fontSize: 13, outline: 'none'
                          }}
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        onClick={() => saveEditSubmission(sub._id)}
                        disabled={savingEdit}
                        style={{
                          flex: 1, padding: '8px', background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e',
                          border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: 8, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          opacity: savingEdit ? 0.5 : 1, fontSize: 12, fontWeight: 700
                        }}
                      >
                        <FiSave size={13} /> Save
                      </button>
                      <button
                        onClick={() => setEditingSubId(null)}
                        disabled={savingEdit}
                        style={{
                          flex: 1, padding: '8px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
                          border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12
                        }}
                      >
                        <FiX size={13} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div><strong>Location:</strong> {sub.parentLocation || sub.location || 'N/A'} {sub.location && sub.parentLocation ? `(${sub.location})` : ''}</div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span><strong>TP:</strong> {sub.tp || '-'}</span>
                        <span><strong>OP:</strong> {sub.op || '-'}</span>
                        <span><strong>FP:</strong> {sub.fp || '-'}</span>
                      </div>
                      <div><strong>Area:</strong> {sub.area || '-'} {sub.areaUnit || ''}</div>
                      <div><strong>Type:</strong> {sub.type || 'N/A'}</div>
                      {sub.landmark && <div><strong>Landmark:</strong> {sub.landmark}</div>}
                      {sub.partyName && <div><strong>Party:</strong> {sub.partyName} {sub.partyPhone ? `(${sub.partyPhone})` : ''}</div>}
                      {sub.brokerName && <div><strong>Broker:</strong> {sub.brokerName} {sub.brokerPhone ? `(${sub.brokerPhone})` : ''}</div>}
                      {sub.remarks && <div><strong>Remarks:</strong> {sub.remarks}</div>}
                      <div style={{ color: '#64748b', fontSize: 11 }}>{sub.coordinates?.length || 0} polygon points</div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        onClick={() => startEditSubmission(sub)}
                        style={{
                          flex: 1, padding: '7px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b',
                          border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600
                        }}
                      >
                        <FiEdit2 size={12} /> Edit
                      </button>
                      {confirmDeleteSubId === sub._id ? (
                        <>
                          <button
                            onClick={() => deleteSubmission(sub._id)}
                            disabled={deletingSubId === sub._id}
                            style={{
                              flex: 1, padding: '7px', background: 'rgba(239, 68, 68, 0.25)', color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: 8, cursor: 'pointer',
                              fontSize: 12, fontWeight: 700, opacity: deletingSubId === sub._id ? 0.5 : 1
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteSubId(null)}
                            style={{
                              flex: 1, padding: '7px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
                              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, cursor: 'pointer', fontSize: 12
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteSubId(sub._id)}
                          style={{
                            flex: 1, padding: '7px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600
                          }}
                        >
                          <FiTrash2 size={12} /> Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }

  // ── List view: all users ────────────────────────────────────────────────
  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ color: '#f8fafc', marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <FiUsers size={16} color="#f59e0b" /> Registered Users
      </h3>

      {loading ? (
        <div style={{ color: '#94a3b8' }}>Loading users...</div>
      ) : users.length === 0 ? (
        <div style={{ color: '#94a3b8', padding: 20 }}>No registered users yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {users.map(user => (
            <div
              key={user._id}
              style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14,
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div
                onClick={() => openUser(user)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <div>
                  <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 14 }}>{user.username}</div>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                    {user.lastSubmissionAt && ` · last active ${new Date(user.lastSubmissionAt).toLocaleDateString()}`}
                  </div>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b', fontWeight: 700, fontSize: 16
                }}>
                  <FiLayers size={14} /> {user.totalProperties}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: 11 }}>
                <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <FiCheckCircle size={11} /> {user.approvedCount} approved
                </span>
                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <FiClock size={11} /> {user.pendingCount} pending
                </span>
                <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <FiXCircle size={11} /> {user.rejectedCount} rejected
                </span>
              </div>

              <div style={{ marginTop: 10 }}>
                {confirmDeleteId === user._id ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleDeleteUser(user._id)}
                      disabled={deletingId === user._id}
                      style={{
                        flex: 1, padding: '7px', background: 'rgba(239, 68, 68, 0.25)', color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: 8, cursor: 'pointer',
                        fontSize: 12, fontWeight: 700, opacity: deletingId === user._id ? 0.5 : 1
                      }}
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{
                        flex: 1, padding: '7px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
                        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, cursor: 'pointer', fontSize: 12
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(user._id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      width: '100%', padding: '7px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600
                    }}
                  >
                    <FiTrash2 size={12} /> Delete User
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
