import { useState, useMemo } from 'react';
import { FiX, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useMapStore } from '../../store/useMapStore';
import { determineParentLocation, buildDynamicLocationMap } from '../../config/categories';
import SearchableSelect from './SearchableSelect';

export default function UserSubmissionModal({ data, onClose, onSubmitSuccess }) {
  const viewerUsername = useMapStore(state => state.viewerUsername);
  const [formData, setFormData] = useState({
    tp: '',
    op: '',
    fp: '',
    area: data?.area || '',
    areaUnit: 'Sq Yard',
    location: '',
    parentLocation: '',
    landmark: '',
    type: 'Freehold',
    remarks: '',
    partyName: '',
    partyPhone: '',
    brokerName: '',
    brokerPhone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customAreas = useMapStore(state => state.customAreas) || [];
  const features = useMapStore(state => state.features);
  const dynamicLocationMap = useMemo(() => buildDynamicLocationMap(features), [features]);
  const allParentLocations = Array.from(new Set([...Object.keys(dynamicLocationMap), ...customAreas])).sort((a, b) => {
    if (a.toLowerCase() === 'surat') return -1;
    if (b.toLowerCase() === 'surat') return 1;
    return a.localeCompare(b);
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const jwt = localStorage.getItem('karmaUserJWT');
    if (!jwt) {
      toast.error('Please sign in first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:5050/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({
          ...formData,
          coordinates: data.coordinates
        })
      });

      if (response.ok) {
        toast.success('Polygon submitted successfully! Waiting for admin approval.');
        onSubmitSuccess();
      } else {
        const errorData = await response.json();
        toast.error(`Submission failed: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to submit polygon. Make sure the server is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#1e293b', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 12,
        padding: 24, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        color: '#f8fafc'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#f59e0b' }}>Submit New Polygon</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            fontSize: 12.5, color: '#94a3b8', background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 8, padding: '8px 12px'
          }}>
            Submitting as <strong style={{ color: '#f59e0b' }}>{viewerUsername}</strong> — track this request anytime from "My Requests".
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Primary Location</label>
              <SearchableSelect
                value={formData.parentLocation || determineParentLocation(formData.location)}
                options={allParentLocations}
                onChange={(val) => {
                  setFormData(prev => {
                    const next = { ...prev, parentLocation: val };
                    const hasSubs = val && (dynamicLocationMap[val] || []).length > 0;
                    next.location = hasSubs ? '' : (val || '');
                    return next;
                  });
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Secondary Location</label>
              <SearchableSelect
                value={formData.location}
                options={dynamicLocationMap[formData.parentLocation || determineParentLocation(formData.location)] || []}
                onChange={(val) => setFormData(prev => ({ ...prev, location: val }))}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Area Unit</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, areaUnit: 'Sq Yard' }))}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 6,
                  border: formData.areaUnit === 'Sq Yard' ? '1px solid #f59e0b' : '1px solid #334155',
                  background: formData.areaUnit === 'Sq Yard' ? 'rgba(245, 158, 11, 0.15)' : '#0f172a',
                  color: formData.areaUnit === 'Sq Yard' ? '#f59e0b' : '#94a3b8',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                Add in Sq Yard
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, areaUnit: 'Wingha' }))}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 6,
                  border: formData.areaUnit === 'Wingha' ? '1px solid #f59e0b' : '1px solid #334155',
                  background: formData.areaUnit === 'Wingha' ? 'rgba(245, 158, 11, 0.15)' : '#0f172a',
                  color: formData.areaUnit === 'Wingha' ? '#f59e0b' : '#94a3b8',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                Add in Wingha
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>T.P.</label>
              <input type="text" name="tp" value={formData.tp} onChange={handleChange}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>O.P.</label>
              <input type="text" name="op" value={formData.op} onChange={handleChange}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>F.P.</label>
              <input type="text" name="fp" value={formData.fp} onChange={handleChange}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Landmark Remarks</label>
              <input type="text" name="landmark" value={formData.landmark} onChange={handleChange}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Category Type</label>
              <select name="type" value={formData.type} onChange={handleChange}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: 'white', boxSizing: 'border-box' }}>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Freehold">Freehold</option>
                <option value="Industrial">Industrial</option>
                <option value="Agriculture">Agriculture</option>
                <option value="Ready Farmhouse">Ready Farmhouse</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Remarks</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={2}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: 'white', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>

          <button type="submit" disabled={isSubmitting}
            style={{
              background: '#f59e0b', color: '#000', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 'bold',
              border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', marginTop: 12,
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Polygon'}
          </button>
        </form>
      </div>
    </div>
  );
}
