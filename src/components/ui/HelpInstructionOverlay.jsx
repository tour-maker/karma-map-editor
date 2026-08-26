import React from 'react';

export default function HelpInstructionOverlay({ onClose }) {
  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' && window.innerWidth <= 768);
  const isAdmin = typeof window !== 'undefined' && window.location.pathname.includes('/admin');

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

      {/* CENTER DISMISS BUTTON */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
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
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.05)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'}
      >
        <span>Close Instructions</span>
        <span style={{
          background: '#ef4444', color: '#ffffff', borderRadius: '50%',
          width: 22, height: 22, display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 12, fontWeight: 900
        }}>✕</span>
      </button>


      {isMobileLandscape ? (
        <>
          {/* LEFT SIDEBAR: TABS */}
          <div style={{
            position: 'absolute', top: 120, left: 235,
            display: 'flex', alignItems: 'flex-start', gap: 6
          }}>
            <div style={{ fontSize: 20, color: '#ffffff' }}>←</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Sidebar Tabs</span>
              <span style={{ fontSize: 10, color: '#cbd5e1', maxWidth: 130, lineHeight: 1.35 }}>
                Browse <b style={{ color: '#f59e0b' }}>Projects</b>, <b style={{ color: '#f59e0b' }}>Landmarks</b>, and <b style={{ color: '#f59e0b' }}>Areas</b>
              </span>
            </div>
          </div>

          {/* LEFT SIDEBAR: Add Area / Project */}
          <div style={{
            position: 'absolute', top: 58, left: 215,
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, color: '#cbd5e1', maxWidth: 140, lineHeight: 1.35 }}>
                ↙ Add new project
              </span>
            </div>
          </div>

          {/* RIGHT DOCK: SHARE & SETTINGS */}
          <div style={{
            position: 'absolute', top: '35%', right: 48,
            textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Tools</span>
            <span style={{ fontSize: 10, color: '#cbd5e1', maxWidth: 120, lineHeight: 1.35, textAlign: 'right' }}>
              Share & Settings
            </span>
            <div style={{ fontSize: 18, color: '#ffffff' }}>→</div>
          </div>

          {/* BOTTOM RIGHT: WHATSAPP CTA */}
          <div style={{
            position: 'absolute', bottom: 58, right: 48,
            textAlign: 'right', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Contact</span>
            </div>
            <div style={{ fontSize: 18, color: '#ffffff' }}>↘</div>
          </div>

          {/* BOTTOM FILTER BAR: FILTERS */}
          <div style={{
            position: 'absolute', bottom: 50, left: '46%',
            transform: 'translateX(-50%)',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Filters</span>
            <span style={{ fontSize: 10, color: '#cbd5e1', maxWidth: 200, lineHeight: 1.35, margin: '2px 0 4px 0' }}>
              Filter by Location & Category
            </span>
            <div style={{ fontSize: 16, color: '#ffffff', marginBottom: 2 }}>↓</div>
          </div>
        </>
      ) : isMobile ? (
        <>
          {/* MOBILE: SEARCH BAR */}
          <div style={{
            position: 'absolute', top: 70, left: 24,
            textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4
          }}>
            <div style={{ fontSize: 20, color: '#ffffff' }}>↑</div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Search</span>
            <span style={{ fontSize: 12, color: '#cbd5e1' }}>Find locations quickly</span>
          </div>

          {/* MOBILE: OPTIONS */}
          <div style={{
            position: 'absolute', top: 70, right: 24,
            textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4
          }}>
            <div style={{ fontSize: 20, color: '#ffffff' }}>↑</div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Options</span>
            <span style={{ fontSize: 12, color: '#cbd5e1' }}>Help & tools</span>
          </div>

          {/* MOBILE: WHATSAPP */}
          <div style={{
            position: 'absolute', bottom: 140, right: 24,
            textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Contact Us</span>
            <span style={{ fontSize: 12, color: '#cbd5e1' }}>on WhatsApp</span>
            <div style={{ fontSize: 20, color: '#ffffff' }}>↓</div>
          </div>

          {/* MOBILE: FILTERS */}
          <div style={{
            position: 'absolute', bottom: 76, left: '40%', transform: 'translateX(-50%)',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Filters</span>
            <span style={{ fontSize: 12, color: '#cbd5e1' }}>Find by category</span>
            <div style={{ fontSize: 20, color: '#ffffff' }}>↓</div>
          </div>
        </>
      ) : (
        <>
          {isAdmin && (
            <>
              {/* LEFT SIDEBAR: TABS — Projects / Landmarks / Area */}
              <div style={{
                position: 'absolute', top: 120, left: 420,
                display: 'flex', alignItems: 'flex-start', gap: 10
              }}>
                <div style={{ fontSize: 22, color: '#ffffff' }}>←</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Sidebar Tabs</span>
                  <span style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 220, lineHeight: 1.35 }}>
                    <b style={{ color: '#f59e0b' }}>Projects</b> — all drawn polygons<br />
                    <b style={{ color: '#f59e0b' }}>Landmarks</b> — named pins on the map<br />
                    <b style={{ color: '#f59e0b' }}>Area</b> — browse by location group
                  </span>
                </div>
              </div>

              {/* LEFT SIDEBAR: Add Area / Add Project button */}
              <div style={{
                position: 'absolute', top: 95, left: 290,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, color: '#cbd5e1', maxWidth: 200, lineHeight: 1.35 }}>
                    ↙ Add a new project or custom area location
                  </span>
                </div>
              </div>
            </>
          )}

          {/* RIGHT DOCK: SHARE */}
          <div style={{
            position: 'absolute', top: 'calc(38% - 2px)', right: 70,
            textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Share</span>
              <span style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 210, lineHeight: 1.35, textAlign: 'right' }}>
                Share via WhatsApp, copy link, etc.
              </span>
            </div>
            <div style={{ fontSize: 20, color: '#ffffff' }}>→</div>
          </div>

          {/* RIGHT DOCK: SETTINGS */}
          <div style={{
            position: 'absolute', top: 'calc(38% + 50px)', right: 70,
            textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Settings</span>
              <span style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 190, lineHeight: 1.35, textAlign: 'right' }}>
                Help, Volume on/off, Screenshot, Fullscreen
              </span>
            </div>
            <div style={{ fontSize: 20, color: '#ffffff' }}>→</div>
          </div>

          {/* BOTTOM RIGHT: WHATSAPP CTA */}
          <div style={{
            position: 'absolute', bottom: 80, right: 80,
            textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Contact Us</span>
              <span style={{ fontSize: 12, color: '#cbd5e1' }}>on WhatsApp</span>
            </div>
            <div style={{ fontSize: 20, color: '#ffffff' }}>↘</div>
          </div>

          {/* BOTTOM FILTER BAR: LANDMARKS TOGGLE */}
          <div style={{
            position: 'absolute', bottom: 7, left: 'calc(50% - 270px)',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>Toggle Landmarks</span>
            <span style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 4, whiteSpace: 'nowrap' }}>Show/hide landmark pins on the map</span>
            <div style={{ fontSize: 20, color: '#ffffff' }}>↓</div>
            <div className="instruction-box-pulse" style={{
              width: 130, height: 48,
              border: '2.5px dashed rgba(255, 255, 255, 0.95)',
              borderBottom: 'none',
              borderRadius: '16px 16px 0 0',
            }} />
          </div>

          {/* BOTTOM FILTER BAR: LOCATION / AREA FILTERS */}
          <div style={{
            position: 'absolute', bottom: 72, left: '52%',
            transform: 'translateX(-50%)',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Filters</span>
            <span style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 340, lineHeight: 1.35, margin: '2px 0 6px 0' }}>
              Filter properties by Location, Area unit (Sq. Yard / Wingha), and Category
            </span>
            <div style={{ fontSize: 18, color: '#ffffff', marginBottom: 4 }}>↓</div>
            <div style={{
              width: 460, borderBottom: '2px dashed rgba(255, 255, 255, 0.75)', position: 'relative'
            }}>
              <span style={{ position: 'absolute', left: -4, top: -5, fontSize: 10, color: '#fff' }}>◄</span>
              <span style={{ position: 'absolute', right: -4, top: -5, fontSize: 10, color: '#fff' }}>►</span>
            </div>
          </div>

          {/* BOTTOM FILTER BAR: PROPERTY COUNT */}
          <div style={{
            position: 'absolute', bottom: 72, left: 'calc(50% + 230px)',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>Properties Found</span>
            <span style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 160, lineHeight: 1.35 }}>
              Live count of polygons matching your current filters
            </span>
            <div style={{ fontSize: 18, color: '#ffffff' }}>↓</div>
          </div>
        </>
      )}

    </div>
  );
}
