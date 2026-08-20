import { describe, it, expect, vi } from 'vitest';
import { exportPolygonsToKml } from '../src/utils/kmlExport';

describe('kmlExport', () => {
  it('exports valid features into a KML document without throwing', () => {
    global.window = global.window || {};
    global.document = global.document || {
      createElement: vi.fn(() => ({ href: '', download: '', click: vi.fn() })),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    };
    global.Blob = global.Blob || class MockBlob { constructor(content) { this.content = content; } };
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    const features = [
      {
        id: '1',
        type: 'polygon',
        data: { name: 'Test Polygon' },
        coordinates: [
          { lat: 10, lng: 10 },
          { lat: 10, lng: 20 },
          { lat: 20, lng: 20 }
        ]
      },
      {
        id: '2',
        type: 'marker',
        data: { name: 'Test Marker' },
        position: { lat: 15, lng: 15 }
      }
    ];

    expect(() => exportPolygonsToKml(features)).not.toThrow();
  });
});
