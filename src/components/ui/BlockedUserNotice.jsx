import { useEffect, useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { USER_BLOCKED_EVENT } from '../../utils/userBlocked';
import { KARMA_CONTACT_PHONE, KARMA_CONTACT_EMAIL } from '../../config/contact';

export default function BlockedUserNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => {
      useMapStore.setState({ viewerUsername: null });
      setOpen(true);
    };
    window.addEventListener(USER_BLOCKED_EVENT, show);
    return () => window.removeEventListener(USER_BLOCKED_EVENT, show);
  }, []);

  if (!open) return null;
  return (
    <div role="alertdialog" aria-modal="true" data-testid="blocked-notice" style={{
      position: 'fixed', inset: 0, zIndex: 2000001, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', padding: 16
    }}>
      <div style={{
        maxWidth: 380, width: '100%', background: '#0f172a', color: '#f8fafc', borderRadius: 16, padding: 24,
        border: '1px solid rgba(239,68,68,0.5)', textAlign: 'center', boxSizing: 'border-box'
      }}>
        <div style={{ fontSize: 34 }}>🚫</div>
        <h3 style={{ margin: '8px 0', color: '#ef4444' }}>Account blocked</h3>
        <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 12px' }}>
          You have been blocked due to violations. For more info, contact Karma Realtors:
        </p>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.8 }}>
          <div>📞 <a href={`tel:${KARMA_CONTACT_PHONE.replace(/\s/g, '')}`} style={{ color: '#f59e0b' }}>{KARMA_CONTACT_PHONE}</a></div>
          {KARMA_CONTACT_EMAIL && <div>✉️ <a href={`mailto:${KARMA_CONTACT_EMAIL}`} style={{ color: '#f59e0b' }}>{KARMA_CONTACT_EMAIL}</a></div>}
        </div>
        <button type="button" onClick={() => setOpen(false)} style={{
          marginTop: 16, padding: '8px 22px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.08)', color: '#f8fafc', cursor: 'pointer', fontWeight: 600
        }}>OK</button>
      </div>
    </div>
  );
}
