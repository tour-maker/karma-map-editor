import React from 'react';
import { GLASS_COLORS, GLASS_RADIUS, GLASS_SHADOW } from '../../styles/glass';

// Union of the on-screen rects of every element matching `selector` (null if none are rendered)
function getUnionRect(selector) {
  if (typeof document === 'undefined') return null;
  const rects = Array.from(document.querySelectorAll(selector))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
  if (rects.length === 0) return null;
  return {
    left: Math.min(...rects.map((r) => r.left)),
    right: Math.max(...rects.map((r) => r.right)),
    top: Math.min(...rects.map((r) => r.top)),
    bottom: Math.max(...rects.map((r) => r.bottom))
  };
}

// Outlines the real buttons (measured from the DOM, so it stays correct however wide the
// filter dock is) and places the label + arrow directly above them.
function ToggleCallout({ selector, title, subtitle }) {
  const rect = getUnionRect(selector);
  if (!rect) return null;
  const pad = 4;
  const centerX = (rect.left + rect.right) / 2;
  const labelX = Math.min(Math.max(centerX, 130), window.innerWidth - 130);

  return (
    <>
      <div className="instruction-box-pulse" style={{
        position: 'absolute',
        left: rect.left - pad, top: rect.top - pad,
        width: rect.right - rect.left + pad * 2, height: rect.bottom - rect.top + pad * 2,
        border: '2.5px dashed rgba(255, 255, 255, 0.95)', borderRadius: 14, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', left: labelX, bottom: window.innerHeight - rect.top + pad + 4,
        transform: 'translateX(-50%)', width: 240,
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
      }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#ffffff' }}>{title}</span>
        <span style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.35, marginBottom: 2 }}>{subtitle}</span>
        <div style={{ fontSize: 20, color: '#ffffff', lineHeight: 1 }}>↓</div>
      </div>
    </>
  );
}

// Every control the portrait-mobile help points at. Rects are measured from the real
// buttons (never hard-coded), so the outlines and badges stay on the right element on any
// phone size, and the legend below can never sit on top of a button.
const MOBILE_OPTIONS_SELECTOR = [
  'button[title="Open options panel"]', 'button[title="Close options panel"]',
  'button[title="Help & Keyboard Shortcuts"]', 'button[title="Mute audio"]', 'button[title="Enable audio"]',
  'button[title="Capture Map Screenshot"]', 'button[title="Exit Fullscreen"]', 'button[title="Fullscreen Mode"]'
].join(', ');

const MOBILE_HELP_TOP = [
  { n: 1, selector: 'input[placeholder*="Search for a place"]', title: 'Search', text: 'Search for a place or property...', short: 'Find a place or property' },
  { n: 2, selector: MOBILE_OPTIONS_SELECTOR, title: 'Options', text: 'Help & tools', short: 'Help & tools' },
  { n: 3, selector: '.viewer-top-bar button:not([title])', title: 'Add Your Property', text: 'Submit a new property listing', short: 'Submit a new listing' },
  { n: 4, selector: '.viewer-top-bar button[title]', title: 'Sign In', text: 'Track your submitted requests', short: 'Track your requests' }
];
const MOBILE_HELP_BOTTOM = [
  { n: 5, selector: '.mobile-share-floating-btn', title: 'Share', text: 'Share the map via WhatsApp, copy link, etc. To share one plot, open it and tap its share icon.', short: 'Share via WhatsApp, copy link, etc.' },
  { n: 6, selector: '.whatsapp-cta-wrapper', title: 'Contact Us', text: 'on WhatsApp', short: 'on WhatsApp' },
  { n: 7, selector: '.mobile-filter-dock-bar', title: 'Filters', text: 'Find by location & category', short: 'By location & category' },
  { n: 8, selector: '.mobile-toggle-chips', title: 'Landmarks & Labels', text: 'Show/hide landmark pins and map labels', short: 'Show/hide pins & labels' }
];

function MobileHelpBadge({ n, rect }) {
  return (
    <div style={{
      position: 'absolute', left: Math.max(2, rect.left - 12), top: Math.max(2, rect.top - 12),
      width: 22, height: 22, borderRadius: '50%', background: '#f59e0b', color: '#1c1406',
      fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 0 2px rgba(0,0,0,0.55)', pointerEvents: 'none'
    }}>{n}</div>
  );
}

function MobileHelpLegend({ items, style, compact }) {
  return (
    <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', gap: compact ? 4 : 8, pointerEvents: 'none', ...style }}>
      {items.map(({ n, title, text, short }) => (
        <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{
            flexShrink: 0, width: compact ? 18 : 20, height: compact ? 18 : 20, borderRadius: '50%', background: '#f59e0b', color: '#1c1406',
            fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1
          }}>{n}</span>
          <span style={{ fontSize: compact ? 11 : 12, color: '#cbd5e1', lineHeight: 1.3 }}>
            <b style={{ fontSize: compact ? 13 : 14, fontWeight: 600, color: '#ffffff' }}>{title}</b> — {compact ? short : text}
          </span>
        </div>
      ))}
    </div>
  );
}

function MobileHelpCallouts() {
  const pad = 4;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // On short screens (e.g. 360x640) the full-length text no longer fits between the
  // controls, so use the compact legend: shorter wording, smaller type, tighter rows.
  const compact = vh < 700;
  const measured = [...MOBILE_HELP_TOP, ...MOBILE_HELP_BOTTOM].map((item) => ({ ...item, rect: getUnionRect(item.selector) }));
  const rectOf = (n) => measured.find((item) => item.n === n)?.rect || null;

  // Top legend: just below the add/sign-in card, left of the options column.
  const search = rectOf(1);
  const options = rectOf(2);
  const topClusterBottom = Math.max(...[1, 3, 4].map((n) => rectOf(n)?.bottom ?? 0));
  const topLegendRight = options ? options.left - 12 : vw - 16;

  // Bottom legend: below the centred Close button, left of the share / contact buttons,
  // and above the Landmarks / Filters controls.
  const share = rectOf(5);
  const contact = rectOf(6);
  const bottomLegendRight = Math.min(...[share, contact].filter(Boolean).map((r) => r.left), vw) - 12;
  const bottomLegendTop = vh / 2 + (compact ? 34 : 40);

  return (
    <>
      {measured.filter((item) => item.rect).map(({ n, rect }) => (
        <React.Fragment key={n}>
          <div className="instruction-box-pulse" style={{
            position: 'absolute',
            left: rect.left - pad, top: rect.top - pad,
            width: rect.right - rect.left + pad * 2,
            // Clamped so a control that sits flush with the screen edge keeps its outline visible.
            height: Math.min(rect.bottom + pad, vh - 2) - (rect.top - pad),
            border: '2px dashed rgba(255, 255, 255, 0.95)', borderRadius: 14, pointerEvents: 'none'
          }} />
          <MobileHelpBadge n={n} rect={{ left: rect.left - pad, top: rect.top - pad }} />
        </React.Fragment>
      ))}

      <MobileHelpLegend
        items={MOBILE_HELP_TOP}
        compact={compact}
        style={{ left: 16, top: (search || options ? topClusterBottom : 90) + (compact ? 10 : 16), width: Math.max(160, topLegendRight - 16) }}
      />
      <MobileHelpLegend
        items={MOBILE_HELP_BOTTOM}
        compact={compact}
        style={{ left: 16, top: bottomLegendTop, width: Math.max(160, bottomLegendRight - 16) }}
      />
    </>
  );
}

export default function HelpInstructionOverlay({ onClose }) {
  const [, setResizeTick] = React.useState(0);
  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' && window.innerWidth <= 768);
  const [isMobileLandscape, setIsMobileLandscape] = React.useState(
    typeof window !== 'undefined' && window.matchMedia('(max-height: 500px) and (orientation: landscape)').matches
  );
  const isAdmin = typeof window !== 'undefined' && window.location.pathname.includes('/admin');

  React.useEffect(() => {
    const handleResize = () => {
      setResizeTick((t) => t + 1); // re-measure the highlighted buttons
      setIsMobile(window.innerWidth <= 768);
      setIsMobileLandscape(window.matchMedia('(max-height: 500px) and (orientation: landscape)').matches);
    };
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
        background: 'rgba(0, 0, 0, 0.65)',
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
          background: GLASS_COLORS.panelBg,
          border: `1px solid ${GLASS_COLORS.border}`,
          borderRadius: `${GLASS_RADIUS.panel}px ${GLASS_RADIUS.panel}px 22px 22px`,
          padding: '12px 24px',
          color: '#f8fafc',
          fontWeight: 600,
          fontSize: 16,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: `${GLASS_SHADOW}, 0 0 24px rgba(245, 158, 11, 0.2)`,
          backdropFilter: 'blur(16px) saturate(150%)',
          WebkitBackdropFilter: 'blur(16px) saturate(150%)',
          zIndex: 100000,
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.05)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'}
      >
        <span style={{ whiteSpace: 'nowrap' }}>Close Instructions</span>
        <span style={{
          background: '#ef4444', color: '#ffffff', borderRadius: '50%',
          width: 22, height: 22, display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0
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
              <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>Sidebar Tabs</span>
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
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>Tools</span>
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
              <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>Contact</span>
            </div>
            <div style={{ fontSize: 18, color: '#ffffff' }}>↘</div>
          </div>

          {/* BOTTOM FILTER BAR: FILTERS */}
          <div style={{
            position: 'absolute', bottom: 50, left: '46%',
            transform: 'translateX(-50%)',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>Filters</span>
            <span style={{ fontSize: 10, color: '#cbd5e1', maxWidth: 200, lineHeight: 1.35, margin: '2px 0 4px 0' }}>
              Filter by Location & Category
            </span>
            <div style={{ fontSize: 16, color: '#ffffff', marginBottom: 2 }}>↓</div>
          </div>
        </>
      ) : isMobile ? (
        <MobileHelpCallouts />
      ) : (
        <>
          {/* TOP LEFT: ADD YOUR PROPERTY / SIGN IN */}
          <div style={{
            position: 'absolute', top: 68, left: 20,
            textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 8
          }}>
            <div style={{ fontSize: 18, color: '#ffffff' }}>↑</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#ffffff' }}>Add Your Property</span>
              <span style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 220, lineHeight: 1.35 }}>Submit a new property listing for review</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#ffffff', marginTop: 6 }}>Sign In</span>
              <span style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 220, lineHeight: 1.35 }}>Create an account or sign in to track your requests</span>
            </div>
          </div>

          {/* TOP CENTER: MAIN SEARCH BAR */}
          <div style={{
            position: 'absolute', top: 68, left: '50%', transform: 'translateX(-50%)',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
          }}>
            <div style={{ fontSize: 18, color: '#ffffff' }}>↑</div>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#ffffff' }}>Search</span>
            <span style={{ fontSize: 12, color: '#cbd5e1' }}>Search for a place or property...</span>
          </div>

          {isAdmin && (
            <>
              {/* LEFT SIDEBAR: TABS — Projects / Landmarks / Area */}
              <div style={{
                position: 'absolute', top: 120, left: 420,
                display: 'flex', alignItems: 'flex-start', gap: 10
              }}>
                <div style={{ fontSize: 22, color: '#ffffff' }}>←</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#ffffff' }}>Sidebar Tabs</span>
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
              <span style={{ fontSize: 16, fontWeight: 600, color: '#ffffff' }}>Share</span>
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
              <span style={{ fontSize: 16, fontWeight: 600, color: '#ffffff' }}>Settings</span>
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
              <span style={{ fontSize: 16, fontWeight: 600, color: '#ffffff' }}>Contact Us</span>
              <span style={{ fontSize: 12, color: '#cbd5e1' }}>on WhatsApp</span>
            </div>
            <div style={{ fontSize: 20, color: '#ffffff' }}>↘</div>
          </div>

          {/* BOTTOM FILTER BAR: LANDMARKS + LABELS TOGGLES */}
          <ToggleCallout
            selector=".filter-landmarks-toggle, .filter-labels-toggle"
            title="Landmarks & Labels"
            subtitle="Show/hide landmark pins and map labels"
          />

          {/* BOTTOM FILTER BAR: LOCATION / AREA FILTERS */}
          <div style={{
            position: 'absolute', bottom: 72, left: '52%',
            transform: 'translateX(-50%)',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#ffffff' }}>Filters</span>
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
            <span style={{ fontSize: 15, fontWeight: 600, color: '#f59e0b' }}>Properties Found</span>
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
