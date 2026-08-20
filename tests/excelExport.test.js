import { describe, it, expect, vi } from 'vitest';
import { exportPolygonCoordinates } from '../src/utils/excelExport';

describe('excelExport', () => {
  it('exports valid features into an Excel document without throwing', () => {
    global.window = global.window || {};
    global.document = global.document || {
      createElement: vi.fn(() => ({ href: '', download: '', click: vi.fn() })),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    };
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    const features = [
      {
        id: '1',
        type: 'polygon',
        data: { name: 'Test Polygon', tp: 'TP1', op: 'OP1' },
        coordinates: [
          { lat: 10, lng: 10 },
          { lat: 10, lng: 20 },
          { lat: 20, lng: 20 }
        ],
        center: { lat: 15, lng: 15 }
      }
    ];

    expect(() => exportPolygonCoordinates(features)).not.toThrow();
  });
});
