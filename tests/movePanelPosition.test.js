import { describe, it, expect } from 'vitest';
import { getMovePanelPosition, MOVE_PANEL_WIDTH, MOVE_PANEL_HEIGHT } from '../src/utils/movePanelPosition';

const desktop = { width: 1440, height: 900 };
const sidebar = { left: 16, right: 435, top: 16, bottom: 884 };
const button = (top) => ({ left: 220, right: 300, top, bottom: top + 24 });

describe('getMovePanelPosition', () => {
  it('opens to the right of the sidebar on a wide screen', () => {
    const pos = getMovePanelPosition({ buttonRect: button(340), sidebarRect: sidebar, viewport: desktop });
    expect(pos.placement).toBe('right');
    expect(pos.left).toBeGreaterThanOrEqual(sidebar.right);
  });

  it('lines up with the clicked button but stays on screen near the bottom', () => {
    const high = getMovePanelPosition({ buttonRect: button(100), sidebarRect: sidebar, viewport: desktop });
    expect(high.top).toBe(90);
    const low = getMovePanelPosition({ buttonRect: button(860), sidebarRect: sidebar, viewport: desktop });
    expect(low.top + MOVE_PANEL_HEIGHT).toBeLessThanOrEqual(desktop.height);
  });

  it('never goes above the top edge', () => {
    expect(getMovePanelPosition({ buttonRect: button(2), sidebarRect: sidebar, viewport: desktop }).top).toBeGreaterThanOrEqual(0);
  });

  it('falls back to below the button when there is no room to the right', () => {
    const tablet = { width: 700, height: 900 };
    const pos = getMovePanelPosition({ buttonRect: button(300), sidebarRect: { ...sidebar, right: 420 }, viewport: tablet });
    expect(pos.placement).toBe('below');
    expect(pos.left + MOVE_PANEL_WIDTH).toBeLessThanOrEqual(tablet.width);
    expect(pos.top).toBe(330);
  });

  it('works when the sidebar cannot be found', () => {
    const pos = getMovePanelPosition({ buttonRect: button(300), sidebarRect: null, viewport: desktop });
    expect(pos.placement).toBe('below');
  });
});
