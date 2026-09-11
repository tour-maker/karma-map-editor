import { useState } from 'react';
import { FiX, FiUser, FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useMapStore } from '../../store/useMapStore';

export default function UserAuthModal({ onClose, onSuccess, title = 'Sign In', subtitle = 'Sign in to submit and track your property requests.' }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const setViewerUsername = useMapStore(state => state.setViewerUsername);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('Please enter a username and password');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/user-login';
      const res = await fetch(`http://localhost:5050${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Something went wrong');
        return;
      }

      localStorage.setItem('karmaUserJWT', data.token);
      setViewerUsername(data.username);
      toast.success(mode === 'signup' ? `Welcome, ${data.username}!` : `Welcome back, ${data.username}!`);
      onSuccess?.(data.username);
    } catch (err) {
      console.error('Auth error:', err);
      toast.error('Cannot reach server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(10, 14, 23, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(11, 17, 30, 0.96) 100%)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: 20, padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        color: '#f8fafc', position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
            padding: 4, borderRadius: 6, display: 'flex'
          }}
        >
          <FiX size={18} />
        </button>

        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
        }}>
          <FiUser size={24} color="#f59e0b" />
        </div>

        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>{title}</h2>
        <p style={{ margin: '6px 0 20px 0', fontSize: 13, color: '#94a3b8' }}>{subtitle}</p>

        <div style={{ display: 'flex', gap: 4, background: 'rgba(30, 41, 59, 0.6)', padding: 3, borderRadius: 10, marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setMode('login')}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 8,
              background: mode === 'login' ? '#f59e0b' : 'transparent',
              color: mode === 'login' ? '#000' : '#94a3b8',
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 8,
              background: mode === 'signup' ? '#f59e0b' : 'transparent',
              color: mode === 'signup' ? '#000' : '#94a3b8',
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              autoFocus
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.15)', background: 'rgba(30, 41, 59, 0.6)',
                color: '#fff', fontSize: 13.5, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter Password'}
                style={{
                  width: '100%', padding: '11px 40px 11px 14px', borderRadius: 10,
                  border: '1px solid rgba(255, 255, 255, 0.15)', background: 'rgba(30, 41, 59, 0.6)',
                  color: '#fff', fontSize: 13.5, outline: 'none', boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
                  display: 'flex', padding: 4
                }}
              >
                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6, width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#000',
              fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)', opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'} <FiArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
