import re

with open('src/components/LandmarkManager.jsx', 'r') as f:
    code = f.read()

target = r"""  if \(geocodeCache\.has\(cacheKey\)\) \{
    return geocodeCache\.get\(cacheKey\);
  \}

  if \(!window\.google\?\.maps\?\.Geocoder\) return null;"""

repl = """  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  // 1. Search our built map first (local features)
  try {
    const features = useMapStore.getState().features || [];
    let bestMatch = null;
    
    for (const f of features) {
      const d = f.data || {};
      const possibleNames = [
        f.id,
        d.name,
        d.location,
        d.subLocation,
        d.landmark
      ].filter(Boolean);
      
      for (const name of possibleNames) {
        // Only check names that aren't generic auto-generated IDs
        if (typeof name === 'string' && name.startsWith('landmark-')) continue;
        
        const cleanName = cleanLandmarkTitle(name).toLowerCase();
        if (!cleanName) continue;
        
        if (cleanName === cacheKey || (cleanName.length > 3 && cacheKey.length > 3 && (cleanName.includes(cacheKey) || cacheKey.includes(cleanName)))) {
          bestMatch = f;
          break;
        }
      }
      if (bestMatch) break;
    }
    
    if (bestMatch) {
      const pos = bestMatch.center || bestMatch.position;
      if (pos) {
        console.log(`[LandmarkManager] Local match found for '${cleanLandmark}' at polygon:`, bestMatch.id);
        geocodeCache.set(cacheKey, pos);
        return pos;
      }
    }
  } catch (err) {
    console.error("Error searching local features for landmark:", err);
  }

  // 2. Fallback to Google Maps Geocoder
  if (!window.google?.maps?.Geocoder) return null;"""

code = re.sub(target, repl, code)

with open('src/components/LandmarkManager.jsx', 'w') as f:
    f.write(code)

