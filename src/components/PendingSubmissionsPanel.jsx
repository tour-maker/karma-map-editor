import { useState, useEffect } from 'react';
import { FiCheck, FiX, FiClock, FiArrowLeft, FiList, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useMapStore } from '../store/useMapStore';
import { useGoogleMap } from '../context/GoogleMapContext';

export default function PendingSubmissionsPanel() {
  const [currentView, setCurrentView] = useState('summary'); // 'summary', 'pending', 'approved', 'rejected'
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [submissions, setSubmissions] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const map = useGoogleMap();
  
  const addFeatures = useMapStore(state => state.addFeatures);
  const removeFeature = useMapStore(state => state.removeFeature);

  useEffect(() => {
    if (currentView === 'summary') {
      fetchStats();
      useMapStore.getState().setPreviewSubmission(null);
    } else {
      fetchSubmissions(currentView);
    }
    return () => {
      useMapStore.getState().setPreviewSubmission(null);
    };
  }, [currentView]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5050/api/submissions/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async (status) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5050/api/submissions?status=${status}`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (sub) => {
    setProcessingId(sub._id);
    try {
      const jwt = localStorage.getItem('karmaAdminJWT');
      const res = await fetch(`http://localhost:5050/api/submissions/${sub._id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      if (!res.ok) throw new Error('Failed to approve on backend');
      const result = await res.json();

      const featureId = result.sheetId || `drawn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newFeature = {
        id: featureId,
        source: 'drawn',
        type: 'polygon',
        coordinates: sub.coordinates,
        data: {
          tp: sub.tp || '', op: sub.op || '', fp: sub.fp || '',
          area: sub.area || '', location: sub.location || '',
          parentLocation: sub.parentLocation || 'Surat', landmark: sub.landmark || '',
          remarks: sub.remarks || '', type: sub.type || 'Freehold'
        },
        style: { fillColor: '#facc15', fillOpacity: 0.4, strokeColor: '#facc15', strokeWeight: 2, visible: true }
      };

      addFeatures([newFeature]);

      if (result.sheetError) {
        toast.success('Approved! (Sheet sync issue: ' + result.sheetError + ')');
      } else {
        toast.success('Approved and added to map & Google Sheet! ✅');
      }

      setSubmissions(prev => prev.filter(s => s._id !== sub._id));
    } catch (error) {
      toast.error('Error approving: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (subId) => {
    setProcessingId(subId);
    try {
      const jwt = localStorage.getItem('karmaAdminJWT');
      const res = await fetch(`http://localhost:5050/api/submissions/${subId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      if (res.ok) {
        toast.success('Submission rejected');
        removeFeature(subId);
        setSubmissions(prev => prev.filter(s => s._id !== subId));
      }
    } catch (error) {
      toast.error('Error rejecting submission');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmissionClick = (sub) => {
    useMapStore.getState().setPreviewSubmission(sub);
    if (map && sub.coordinates && sub.coordinates.length > 0) {
      if (!window.google?.maps) return;
      let bounds = new window.google.maps.LatLngBounds();
      sub.coordinates.forEach(c => {
        if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
          bounds.extend(new window.google.maps.LatLng(c.lat, c.lng));
        }
      });
      if (!bounds.isEmpty()) {
        map.panTo(bounds.getCenter());
        map.setZoom(15);
      }
    }
  };

  if (currentView === 'summary') {
    return (
      <div style={{ padding: 16 }}>
        <h3 style={{ color: '#f8fafc', marginBottom: 16, fontSize: 14 }}>Requests Summary</h3>
        {loading ? (
          <div style={{ color: '#94a3b8' }}>Loading stats...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div 
              onClick={() => setCurrentView('pending')}
              style={{
                background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: 16, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#f59e0b', fontWeight: 'bold' }}>
                <FiList size={20} /> Pending
              </div>
              <span style={{ color: '#f8fafc', fontSize: 20, fontWeight: 'bold' }}>{stats.pending || 0}</span>
            </div>

            <div 
              onClick={() => setCurrentView('approved')}
              style={{
                background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
                padding: 16, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#22c55e', fontWeight: 'bold' }}>
                <FiCheckCircle size={20} /> Approved
              </div>
              <span style={{ color: '#f8fafc', fontSize: 20, fontWeight: 'bold' }}>{stats.approved || 0}</span>
            </div>

            <div 
              onClick={() => setCurrentView('rejected')}
              style={{
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: 16, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#ef4444', fontWeight: 'bold' }}>
                <FiXCircle size={20} /> Rejected
              </div>
              <span style={{ color: '#f8fafc', fontSize: 20, fontWeight: 'bold' }}>{stats.rejected || 0}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button 
          onClick={() => setCurrentView('summary')}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <FiArrowLeft /> Back
        </button>
        <span style={{ color: '#f8fafc', fontWeight: 'bold', textTransform: 'capitalize' }}>
          {currentView} Requests
        </span>
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8', padding: 20 }}>Loading...</div>
      ) : submissions.length === 0 ? (
        <div style={{ color: '#94a3b8', padding: 20 }}>No {currentView} submissions found.</div>
      ) : (
        submissions.map(sub => (
          <div key={sub._id} 
               onClick={() => handleSubmissionClick(sub)}
               style={{
            background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16,
            border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
            transition: 'background 0.2s, transform 0.1s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{sub.loginId}</span>
              <span style={{ color: '#64748b', fontSize: 12 }}><FiClock /> {new Date(sub.createdAt).toLocaleDateString()}</span>
            </div>
            
            <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 12 }}>
              <div><strong>Location:</strong> {sub.parentLocation || sub.location} {sub.location && sub.parentLocation ? `(${sub.location})` : ''}</div>
              <div><strong>Area:</strong> {sub.area || 'N/A'}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <span><strong>TP:</strong> {sub.tp || '-'}</span>
                <span><strong>OP:</strong> {sub.op || '-'}</span>
                <span><strong>FP:</strong> {sub.fp || '-'}</span>
              </div>
              <div style={{ marginTop: 4 }}><strong>Type:</strong> {sub.type || 'N/A'}</div>
              {sub.landmark && <div><strong>Landmark:</strong> {sub.landmark}</div>}
              {sub.remarks && <div><strong>Remarks:</strong> {sub.remarks}</div>}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {sub.status !== 'approved' && (
                <button
                  onClick={() => handleApprove(sub)}
                  disabled={processingId === sub._id}
                  style={{
                    flex: 1, padding: '8px', background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: 8, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: processingId === sub._id ? 0.5 : 1
                  }}
                >
                  <FiCheck /> Approve
                </button>
              )}
              {sub.status !== 'rejected' && (
                <button
                  onClick={() => handleReject(sub._id)}
                  disabled={processingId === sub._id}
                  style={{
                    flex: 1, padding: '8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 8, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: processingId === sub._id ? 0.5 : 1
                  }}
                >
                  <FiX /> Reject
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
