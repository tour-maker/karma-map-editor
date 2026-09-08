import re

with open('src/services/googleMaps.js', 'r') as f:
    code = f.read()

target = r"""  if \(targetCenter\) \{
    // Smoothly pan to the center
    map\.panTo\(targetCenter\);"""

repl = """  if (targetCenter) {
    // Apply a vertical offset for Mobile Portrait so the polygon isn't hidden by the bottom info panel
    const isMobilePortrait = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches;
    if (isMobilePortrait && map.getProjection()) {
      const projection = map.getProjection();
      const targetPoint = projection.fromLatLngToPoint(targetCenter);
      if (targetPoint) {
        // Move the center point South (positive Y) so the polygon appears higher on the screen
        const offsetPixels = window.innerHeight * 0.25; // Offset by 25% of screen height
        const scale = Math.pow(2, targetZoom);
        targetPoint.y += offsetPixels / scale;
        
        // Convert back to LatLng
        const offsetLatLng = projection.fromPointToLatLng(targetPoint);
        if (offsetLatLng) {
          targetCenter = offsetLatLng;
        }
      }
    }

    // Smoothly pan to the center
    map.panTo(targetCenter);"""

code = re.sub(target, repl, code)

with open('src/services/googleMaps.js', 'w') as f:
    f.write(code)

