import { useState } from 'react';
import { FiX, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useMapStore } from '../../store/useMapStore';
import { CATEGORY_MAP, determineParentLocation } from '../../config/categories';
import SearchableSelect from './SearchableSelect';

export default function UserSubmissionModal({ data, onClose, onSubmitSuccess }) {
  const [formData, setFormData] = useState({
    loginId: '',
    password: '',
    tp: '',
    op: '',
    fp: '',
    area: data?.area || '',
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
  const allParentLocations = Array.from(new Set([...Object.keys(CATEGORY_MAP), ...customAreas])).sort();
  const allSecondaryLocations = Array.from(new Set([...Object.values(CATEGORY_MAP).flat(), ...customAreas])).filter(Boolean).sort();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.loginId || !formData.password) {
      toast.error('Login ID and Password are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:5050/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Login ID *</label>
              <input type="text" name="loginId" value={formData.loginId} onChange={handleChange} required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Password *</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Primary Location</label>
              <SearchableSelect
                value={formData.parentLocation || determineParentLocation(formData.location)}
                options={allParentLocations}
                onChange={(val) => setFormData(prev => ({ ...prev, parentLocation: val }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Secondary Location</label>
              <SearchableSelect
                value={formData.location}
                options={allSecondaryLocations}
                onChange={(val) => setFormData(prev => ({ ...prev, location: val }))}
              />
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
