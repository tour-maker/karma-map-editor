import React, { useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { FiLock, FiArrowRight } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminAuthOverlay() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const setIsAdminAuthenticated = useMapStore(state => state.setIsAdminAuthenticated);

  const handleLogin = (e) => {
    e.preventDefault();
    const validUsername = import.meta.env.VITE_ADMIN_USER || 'admin';
    const validPassword = import.meta.env.VITE_ADMIN_PASS || 'karma@2024';

    if (username === validUsername && password === validPassword) {
      setIsAdminAuthenticated(true);
      toast.success('Admin access granted!', {
        style: { background: '#0f172a', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
      });
    } else {
      toast.error('Invalid ID or Password!', {
        style: { background: '#0f172a', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' }
      });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999, // Super high z-index to cover everything
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

        <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginLeft: 4 }}>Admin ID</label>
            <input
              type="text"
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Password"
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
