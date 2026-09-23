import { useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { API_BASE_URL } from '../../config/api';
import { FiLock, FiArrowRight, FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminAuthOverlay() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const setIsAdminAuthenticated = useMapStore(state => state.setIsAdminAuthenticated);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('karmaAdminJWT', data.token);
        setIsAdminAuthenticated(true);
        toast.success('Admin access granted!', {
          style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
        });
      } else {
        setErrorMessage(data?.error || 'Invalid ID or Password!');
      }
    } catch (err) {
      setErrorMessage('Cannot reach server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2000000, // Must clear Google Maps' own overlays (which can render around z-index 1000000/1000001)
      background: 'rgba(10, 14, 23, 0.75)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: 24,
        padding: '40px',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          border: '1px solid rgba(245, 158, 11, 0.3)'
        }}>
          <FiLock size={28} color="#f59e0b" />
        </div>

        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 8px 0' }}>Admin Authentication</h2>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 24px 0' }}>Please enter your credentials to access the Karma Map Editor admin panel.</p>

        {errorMessage && (
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 12.5,
            fontWeight: 600,
            textAlign: 'left',
            marginBottom: 16,
            boxSizing: 'border-box'
          }}>
            <FiAlertCircle size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginLeft: 4 }}>Admin ID</label>
            <input
              type="text"
              className="karma-glass-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter ID"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(30, 41, 59, 0.6)',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginLeft: 4 }}>Password</label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPassword ? "text" : "password"}
                className="karma-glass-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 16px',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(30, 41, 59, 0.6)',
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4
                }}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            style={{
              marginTop: 8,
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#000',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
              transition: 'transform 0.15s ease'
            }}
          >
            Access Editor <FiArrowRight size={18} />
          </button>
        </form>

        <button 
          onClick={() => {
             // Redirect back to normal viewer mode
             window.location.href = '/';
          }}
          style={{
            marginTop: 20,
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          Return to Viewer Mode
        </button>
      </div>
    </div>
  );
}
