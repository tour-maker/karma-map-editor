import React from 'react';
import { FiRefreshCw } from 'react-icons/fi';

export default function HelpInstructionOverlay({ onClose }) {
  return (
    <div
      onClick={onClose}
      className="help-instruction-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(10, 14, 23, 0.45)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        fontFamily: 'Inter, system-ui, sans-serif',
        userSelect: 'none',
        color: '#ffffff',
        cursor: 'default',
        animation: 'fadeInOverlay 0.25s ease-out'
      }}
    >
      {/* Keyframe style for fade in and pulse */}
      <style>{`
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .instruction-box-pulse {
          animation: boxPulse 2s infinite ease-in-out;
        }
        @keyframes boxPulse {
          0%, 100% { border-color: rgba(255, 255, 255, 0.85); box-shadow: 0 0 10px rgba(255,255,255,0.3); }
          50% { border-color: rgba(245, 158, 11, 0.95); box-shadow: 0 0 20px rgba(245,158,11,0.5); }
        }
      `}</style>

      {/* CENTER DISMISS BUTTON ("Close Instruction ❌" - RESTORED TO ORIGINAL SIZE) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(15, 23, 42, 0.70)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '14px 14px 22px 22px',
          padding: '12px 24px',
          color: '#f8fafc',
          fontWeight: 700,
          fontSize: 16,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(245, 158, 11, 0.2)',
          backdropFilter: 'blur(16px)',
          zIndex: 100000,
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.05)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'}
      >
        <span>Close Instruction</span>
        <span style={{
          background: '#ef4444',
          color: '#ffffff',
          borderRadius: '50%',
          width: 22,
          height: 22,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 900
        }}>
          ✕
        </span>
      </button>

      {/* LEFT SIDEBAR DIRECTORY CALLOUT */}
      <div style={{
        position: 'absolute',
        top: 140,
        left: 412,
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}>
        <div style={{ fontSize: 22, color: '#ffffff' }}>←</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Project Directory</span>
          <span style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 220, lineHeight: 1.35 }}>
            Browse all 307+ properties, TP/OP/FP numbers & area details.
          </span>
        </div>
      </div>

      {/* TOP RIGHT: MODE TOGGLE (EDIT / VIEWER) */}
      <div style={{
        position: 'absolute',
        top: 60,
        right: 40,
        textAlign: 'right',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end'
      }}>
        <div style={{ fontSize: 18, color: '#ffffff', marginBottom: 2 }}>↑</div>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Switch Mode</span>
        <span style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 180, lineHeight: 1.35 }}>
          Switch between Edit & Viewer modes
        </span>
      </div>

      {/* RIGHT ACTION DOCK: SHARE BUTTON */}
      <div style={{
        position: 'absolute',
        top: 'calc(38% - 5px)',
        right: 50,
        textAlign: 'right',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Share</span>
          <span style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 210, lineHeight: 1.35, textAlign: 'right' }}>
            via WhatsApp, Facebook, Email, or copy the link.
          </span>
        </div>
        <div style={{ fontSize: 20, color: '#ffffff', marginLeft: 4 }}>→</div>
      </div>

      {/* RIGHT ACTION DOCK: SETTINGS / OPTIONS PANEL */}
      <div style={{
        position: 'absolute',
        top: 'calc(38% + 60px)',
        right: 50,
        textAlign: 'right',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Settings</span>
          <span style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 190, lineHeight: 1.35, textAlign: 'right' }}>
            (i.e. full screen, help, music etc)
          </span>
        </div>
        <div style={{ fontSize: 20, color: '#ffffff', marginLeft: 4 }}>→</div>
      </div>

      {/* 3. WHATSAPP CTA CALLOUT (MOVED UP) */}
      <div style={{
        position: 'absolute',
        bottom: 80,
        right: 80,
        textAlign: 'right',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Contact Us</span>
          <span style={{ fontSize: 12, color: '#cbd5e1' }}>on WhatsApp</span>
        </div>
        <div style={{ fontSize: 20, color: '#ffffff', marginLeft: 4 }}>↘</div>
      </div>

      {/* 1. LANDMARKS CALLOUT (ENLARGED HIGHLIGHT PILL) */}
      <div style={{
        position: 'absolute',
        bottom: 7,
        left: 625,
        transform: 'translateX(-49%)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>Toggle (on/off)</span>
        <span style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 4, whiteSpace: 'nowrap' }}>near by Landmarks</span>
        <div style={{ fontSize: 20, color: '#ffffff' }}>↓</div>
        {/* Larger Highlight Dashed Box for Landmarks */}
        <div className="instruction-box-pulse" style={{
          width: 145,
          height: 54,
          border: '2.5px dashed rgba(255, 255, 255, 0.95)',
          borderBottom: 'none',
          borderRadius: '18px 18px 0 0',
          marginTop: 4
        }} />
      </div>

      {/* BOTTOM FILTER BAR: RESET ALL */}
      <div style={{
        position: 'absolute',
        bottom: 72,
        left: 765,
        transform: 'translateX(-50%)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Reset All</span>
        <span style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 4, whiteSpace: 'nowrap' }}>Reset All Filters in single click</span>
        <div style={{ fontSize: 18, color: '#ffffff', marginBottom: 6 }}>↓</div>
        {/* Replica Reset All Pill Button */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(245, 158, 11, 0.6)',
          borderRadius: '8px 8px 14px 14px',
          padding: '6px 14px',
          color: '#f8fafc',
          fontSize: 12.5,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6), 0 0 12px rgba(245, 158, 11, 0.25)',
          whiteSpace: 'nowrap'
        }}>
          <FiRefreshCw size={12} color="#f59e0b" /> Reset All
        </div>
      </div>

      {/* BOTTOM CENTER: FILTER BAR */}
      <div style={{
        position: 'absolute',
        bottom: 80,
        left: 'calc(50% + 140px)',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Filter</span>
        <span style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 280, lineHeight: 1.35, margin: '2px 0 6px 0' }}>
          Quickly find properties using filters like Sq. Yard/Wingha , Category, Area.
        </span>
        {/* Downward Arrow */}
        <div style={{ fontSize: 18, color: '#ffffff', marginBottom: 4 }}>↓</div>
        {/* Dashed Horizontal Range Line across FilterBar */}
        <div style={{
          width: 490,
          borderBottom: '2px dashed rgba(255, 255, 255, 0.75)',
          position: 'relative'
        }}>
          <span style={{ position: 'absolute', left: -4, top: -5, fontSize: 10, color: '#fff' }}>◄</span>
          <span style={{ position: 'absolute', right: -4, top: -5, fontSize: 10, color: '#fff' }}>►</span>
        </div>
      </div>

    </div>
  );
}
