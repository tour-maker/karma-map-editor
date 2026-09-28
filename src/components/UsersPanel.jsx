import { useState, useEffect } from 'react';
import { FiUsers, FiArrowLeft, FiTrash2, FiCheckCircle, FiClock, FiXCircle, FiLayers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config/api';

// Admin-only panel: lists registered viewer accounts with per-user submission
// stats, and a drill-down into that user's actual properties. Mirrors the
// summary → detail pattern already used by PendingSubmissionsPanel so it fits
// the same "Requests" tab UX the admin is already used to.
export default function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null); // { _id, username, ... } or null
  const [userSubmissions, setUserSubmissions] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const jwt = localStorage.getItem('karmaAdminJWT');
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      if (res.ok) {
        setUsers(await res.json());
      } else {
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
      const jwt = localStorage.getItem('karmaAdminJWT');
      const res = await fetch(`${API_BASE_URL}/api/users/${user._id}/submissions`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      if (res.ok) {
        setUserSubmissions(await res.json());
      } else {
        toast.error('Failed to load this user\'s properties');
      }
    } catch (error) {
      console.error('Failed to fetch user submissions:', error);
      toast.error('Failed to load this user\'s properties');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    setDeletingId(userId);
    try {
      const jwt = localStorage.getItem('karmaAdminJWT');
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      if (res.ok) {
        toast.success('User deleted');
        setUsers(prev => prev.filter(u => u._id !== userId));
        if (selectedUser?._id === userId) setSelectedUser(null);
      } else {
        toast.error('Failed to delete user');
      }
    } catch (error) {
      toast.error('Error deleting user');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
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
          userSubmissions.map(sub => (
            <div key={sub._id} style={{
              background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16,
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{
                  fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px',
                  color: sub.status === 'approved' ? '#22c55e' : sub.status === 'rejected' ? '#ef4444' : '#f59e0b'
                }}>
                  {sub.status}
                </span>
                <span style={{ color: '#64748b', fontSize: 12 }}><FiClock /> {new Date(sub.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={{ fontSize: 13, color: '#e2e8f0' }}>
                <div><strong>Location:</strong> {sub.parentLocation || sub.location} {sub.location && sub.parentLocation ? `(${sub.location})` : ''}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <span><strong>TP:</strong> {sub.tp || '-'}</span>
                  <span><strong>OP:</strong> {sub.op || '-'}</span>
                  <span><strong>FP:</strong> {sub.fp || '-'}</span>
                </div>
                <div style={{ marginTop: 4 }}><strong>Type:</strong> {sub.type || 'N/A'}</div>
              </div>
            </div>
          ))
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
                      onClick={() => handleDelete(user._id)}
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
