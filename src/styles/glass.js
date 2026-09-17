// Shared premium glassmorphism design tokens — applied consistently across all
// floating UI panels (FilterBar, PropertyInfoPanel, MyRequestsPanel, UserAuthModal,
// HelpInstructionOverlay, etc). Keep the existing gold/navy identity; this only
// standardizes blur, edges, shadows and type treatment.

export const GLASS_COLORS = {
  panelBg: 'rgba(15, 23, 42, 0.75)',
  border: 'rgba(245, 158, 11, 0.25)',
  borderActive: '#f59e0b',
};

// Client brand gold for UI chrome (buttons, active toggles, focus rings), taken
// directly from the live site's search button. #FDB713 is the dominant flat
// tone; the gradient only adds a subtle highlight for dimension.
// Keep #f59e0b for map-canvas elements (selected polygons etc) — this is chrome-only.
export const GOLD_SOLID = '#FDB713';
export const GOLD_GRADIENT = 'linear-gradient(180deg, #FFCB4D 0%, #FDB713 35%, #FDB713 100%)';
export const GOLD_GRADIENT_SHADOW = 'inset 0 1px 1px rgba(255,255,255,0.3), 0 4px 16px rgba(253,183,19,0.35)';

export const GLASS_RADIUS = {
  panel: 16,
  control: 10,
};

export const GLASS_SHADOW = '0 8px 32px rgba(0,0,0,0.35)';
export const GLASS_BLUR = 'blur(16px) saturate(150%)';

// Spread onto a panel/modal/dropdown surface's style object.
export const glassPanelStyle = {
  background: GLASS_COLORS.panelBg,
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  border: `1px solid ${GLASS_COLORS.border}`,
  borderRadius: GLASS_RADIUS.panel,
  boxShadow: GLASS_SHADOW,
};

// Spread onto a panel/modal surface that should read as "active" (e.g. selected state).
export const glassPanelActiveStyle = {
  ...glassPanelStyle,
  border: `2px solid ${GLASS_COLORS.borderActive}`,
};

// Spread onto a button/input/chip.
export const glassControlStyle = {
  borderRadius: GLASS_RADIUS.control,
};

export const GLASS_FONT = {
  heading: { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 600 },
  body: { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 400 },
  // Client's real brand typeface (used on their live site) — headings/buttons/brand text.
  serif: { fontFamily: "'Montserrat', system-ui, sans-serif", fontWeight: 700 },
};
