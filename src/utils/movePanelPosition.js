export const MOVE_PANEL_WIDTH = 260;
export const MOVE_PANEL_HEIGHT = 420;
const MARGIN = 12;

// Where the Move Area panel goes. Beside the sidebar (to its right) when there is room, so it
// never covers the list it was opened from; otherwise below the button that opened it. Either
// way it is kept fully inside the screen.
export function getMovePanelPosition({ buttonRect, sidebarRect, viewport, width = MOVE_PANEL_WIDTH, height = MOVE_PANEL_HEIGHT }) {
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

  if (sidebarRect && viewport.width - sidebarRect.right - MARGIN * 2 >= width) {
    return {
      placement: 'right',
      left: sidebarRect.right + MARGIN,
      top: clamp(buttonRect.top - 10, MARGIN, viewport.height - height - MARGIN)
    };
  }

  return {
    placement: 'below',
    left: clamp(buttonRect.left, MARGIN, viewport.width - width - MARGIN),
    top: clamp(buttonRect.bottom + 6, MARGIN, viewport.height - height - MARGIN)
  };
}
