import { useState, useEffect, useMemo } from 'react';
import { FiCheck, FiX, FiClock, FiArrowLeft, FiList, FiCheckCircle, FiXCircle, FiEdit2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useMapStore } from '../store/useMapStore';
import { useGoogleMap } from '../context/GoogleMapContext';
import { API_BASE_URL } from '../config/api';
import { CATEGORY_MAP, buildDynamicLocationMap } from '../config/categories';
import SearchableSelect from './ui/SearchableSelect';

export default function PendingSubmissionsPanel() {
  const [currentView, setCurrentView] = useState('summary'); // 'summary', 'pending', 'approved', 'rejected'
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [submissions, setSubmissions] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const map = useGoogleMap();
  
  const addFeatures = useMapStore(state => state.addFeatures);
  const removeFeature = useMapStore(state => state.removeFeature);
  const features = useMapStore(state => state.features);
  const customAreas = useMapStore(state => state.customAreas) || [];
  const syncedAreas = useMapStore(state => state.syncedAreas) || [];

  // Full lists for the Parent Area / Sub Area dropdowns, built from every place an area can
  // live: the built-in list, areas the admin created, the Areas sheet, and the plots themselves.
  const { parentOptions, subOptionsFor } = useMemo(() => {
    const dynamicMap = buildDynamicLocationMap(features);
    const isReal = (n) => n && String(n).trim() && String(n).trim().toLowerCase() !== 'unassigned';
    const parents = Array.from(new Set([
      ...Object.keys(CATEGORY_MAP), ...customAreas, ...Object.keys(dynamicMap), ...syncedAreas.map(a => a.parent)
    ].filter(isReal))).sort((a, b) => {
      if (a.toLowerCase() === 'surat') return -1;
      if (b.toLowerCase() === 'surat') return 1;
      return a.localeCompare(b);
    });
    const subsFor = (parent) => {
      const key = String(parent || '').trim().toLowerCase();
      if (!key) return [];
      const owners = (obj) => Object.keys(obj).filter(k => k.toLowerCase() === key);
      return Array.from(new Set([
        ...owners(CATEGORY_MAP).flatMap(k => CATEGORY_MAP[k] || []),
        ...owners(dynamicMap).flatMap(k => dynamicMap[k] || []),
        ...syncedAreas.filter(a => String(a.parent || '').trim().toLowerCase() === key).map(a => a.secondary)
      ].filter(isReal))).sort((a, b) => a.localeCompare(b));
    };
    return { parentOptions: parents, subOptionsFor: subsFor };
  }, [features, customAreas, syncedAreas]);

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
      const jwt = sessionStorage.getItem('karmaAdminJWT');
      const response = await fetch(`${API_BASE_URL}/api/submissions/stats`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
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
      const jwt = sessionStorage.getItem('karmaAdminJWT');
      const response = await fetch(`${API_BASE_URL}/api/submissions?status=${status}`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
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
      const jwt = sessionStorage.getItem('karmaAdminJWT');
      const res = await fetch(`${API_BASE_URL}/api/submissions/${sub._id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      if (!res.ok) throw new Error('Failed to approve on backend');
      const result = await res.json();
      window.dispatchEvent(new Event('karma-submissions-changed'));

      const featureId = result.sheetId || `drawn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newFeature = {
        id: featureId,
        source: 'drawn',
        type: 'polygon',
        coordinates: sub.coordinates,
        data: {
          tp: sub.tp || '', op: sub.op || '', fp: sub.fp || '',
          area: sub.area || '', location: sub.location || sub.parentLocation || '',
          areaUnit: sub.areaUnit || 'Sq Yard',
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
      const jwt = sessionStorage.getItem('karmaAdminJWT');
      const res = await fetch(`${API_BASE_URL}/api/submissions/${subId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      if (res.ok) {
        window.dispatchEvent(new Event('karma-submissions-changed'));
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

  const startEditing = (sub) => {
    setEditingId(sub._id);
    setEditData(Object.fromEntries(['tp', 'op', 'fp', 'area', 'areaUnit', 'location', 'parentLocation', 'landmark', 'type', 'remarks'].map(key => [key, sub[key] || ''])));
  };

  const saveEdit = async (subId) => {
    setProcessingId(subId);
    try {
      const jwt = sessionStorage.getItem('karmaAdminJWT');
      const res = await fetch(`${API_BASE_URL}/api/submissions/${subId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
        body: JSON.stringify(editData)
      });
      if (!res.ok) throw new Error('Failed to update submission');
      const result = await res.json();
      setSubmissions(prev => prev.map(sub => sub._id === subId ? result.submission : sub));
      setEditingId(null);
      toast.success('Submission updated');
    } catch (error) {
      toast.error(error.message || 'Error updating submission');
    } finally {
      setProcessingId(null);
    }
  };

  const zoomToSubmission = (sub) => {
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

  const handleSubmissionClick = (sub) => {
    useMapStore.getState().setPreviewSubmission(sub);
    zoomToSubmission(sub);
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
              <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{sub.username}</span>
              <span style={{ color: '#64748b', fontSize: 12 }}><FiClock /> {new Date(sub.createdAt).toLocaleDateString()}</span>
            </div>
            
            {editingId === sub._id ? (
              <div onClick={e => e.stopPropagation()} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {(() => {
                  const labelStyle = { color: '#94a3b8', fontSize: 11 };
                  const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 3, padding: 7, borderRadius: 6, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(15,23,42,0.8)', color: '#f8fafc' };
                  const textField = (field, label) => (
                    <label key={field} style={labelStyle}>{label}
                      <input value={editData[field]} onChange={e => setEditData(prev => ({ ...prev, [field]: e.target.value }))} style={inputStyle} />
                    </label>
                  );
                  const isWingha = /wingha|vingha|vigha/i.test(String(editData.areaUnit || ''));
                  const unitButton = (value, active) => (
                    <button type="button" key={value} onClick={() => setEditData(prev => ({ ...prev, areaUnit: value }))}
                      style={{ flex: 1, marginTop: 3, padding: '7px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        border: active ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.18)',
                        background: active ? 'rgba(245,158,11,0.2)' : 'rgba(15,23,42,0.8)',
                        color: active ? '#fbbf24' : '#94a3b8' }}>
                      {value}
                    </button>
                  );
                  return (
                    <>
                      {textField('tp', 'TP')}
                      {textField('op', 'OP')}
                      {textField('fp', 'FP')}
                      {textField('type', 'Type')}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={labelStyle}>Area</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                          <input value={editData.area} onChange={e => setEditData(prev => ({ ...prev, area: e.target.value }))}
                            inputMode="decimal" style={{ ...inputStyle, flex: 1.4, width: 'auto' }} />
                          {unitButton('Sq Yard', !isWingha)}
                          {unitButton('Wingha', isWingha)}
                        </div>
                      </div>
                      <div style={labelStyle}>Parent Area
                        <div style={{ marginTop: 3 }}>
                          <SearchableSelect
                            value={editData.parentLocation}
                            options={parentOptions}
                            placeholder="Select parent area"
                            onChange={(val) => setEditData(prev => {
                              const subs = subOptionsFor(val);
                              const keepSub = subs.some(s => s.toLowerCase() === String(prev.location || '').toLowerCase());
                              // No sub-areas -> the plot sits directly under the parent (location = parent),
                              // the same convention the rest of the app and the sheet use.
                              return { ...prev, parentLocation: val, location: keepSub ? prev.location : (subs.length > 0 ? '' : val) };
                            })}
                          />
                        </div>
                      </div>
                      <div style={labelStyle}>Sub Area
                        <div style={{ marginTop: 3 }}>
                          <SearchableSelect
                            value={editData.location}
                            options={subOptionsFor(editData.parentLocation)}
                            disabled={subOptionsFor(editData.parentLocation).length === 0}
                            placeholder={subOptionsFor(editData.parentLocation).length === 0 ? 'No sub-areas' : 'Select sub area'}
                            onChange={(val) => setEditData(prev => ({ ...prev, location: val }))}
                          />
                        </div>
                      </div>
                      {textField('landmark', 'Landmark')}
                      {textField('remarks', 'Remarks')}
                    </>
                  );
                })()}
              </div>
            ) : <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 12 }}>
              <div><strong>Parent Area:</strong> {sub.parentLocation || sub.location || '-'}</div>
              <div><strong>Sub Area:</strong> {sub.location && sub.location !== sub.parentLocation ? sub.location : '-'}</div>
              <div><strong>Area:</strong> {sub.area ? `${sub.area} ${sub.areaUnit || ''}`.trim() : 'N/A'}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <span><strong>TP:</strong> {sub.tp || '-'}</span>
                <span><strong>OP:</strong> {sub.op || '-'}</span>
                <span><strong>FP:</strong> {sub.fp || '-'}</span>
              </div>
              <div style={{ marginTop: 4 }}><strong>Type:</strong> {sub.type || 'N/A'}</div>
              {sub.landmark && <div><strong>Landmark:</strong> {sub.landmark}</div>}
              {sub.remarks && <div><strong>Remarks:</strong> {sub.remarks}</div>}
            </div>}

            <div style={{ display: 'flex', gap: 8 }}>
              {sub.status === 'pending' && (editingId === sub._id ? <>
                <button onClick={e => { e.stopPropagation(); saveEdit(sub._id); }} disabled={processingId === sub._id} style={{ flex: 1, padding: 8, background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 8, cursor: 'pointer' }}>Save</button>
                <button onClick={e => { e.stopPropagation(); setEditingId(null); }} style={{ flex: 1, padding: 8, background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
              </> : <button onClick={e => { e.stopPropagation(); zoomToSubmission(sub); startEditing(sub); }} style={{ flex: 1, padding: '8px', background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><FiEdit2 /> Edit</button>)}
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
