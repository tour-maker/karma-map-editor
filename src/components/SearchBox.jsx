import { Autocomplete } from '@react-google-maps/api';
import { useCallback, useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

const inputStyle = {
  width: '100%',
  padding: '12px 20px',
  borderRadius: '24px',
  border: '1px solid rgba(255, 255, 255, 0.22)',
  fontSize: '14.5px',
  fontWeight: '500',
  outline: 'none',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.65)',
  background: 'rgba(10, 14, 23, 0.70)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  color: '#f8fafc',
  boxSizing: 'border-box'
};

function SearchBox({ onPlaceSelected, placeholder = 'Search for a place or property...', containerStyle }) {
  const [autocomplete, setAutocomplete] = useState(null);
  const [searchValue, setSearchValue] = useState('');

  const handleLoad = useCallback((autocompleteInstance) => {
    setAutocomplete(autocompleteInstance);
  }, []);

  const handlePlaceChanged = useCallback(() => {
    if (!autocomplete) return;

    const place = autocomplete.getPlace();
    if (place?.geometry?.location) {
      onPlaceSelected?.(place);
    }
  }, [autocomplete, onPlaceSelected]);

  const executeSearch = useCallback((val) => {
    if (!val || !val.trim()) return;
    const query = val.trim();

    // 1. Match coordinate pairs like "21.123, 72.456"
    const coordMatch = query.match(/^\s*(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)\s*$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        if (window.google?.maps?.LatLng) {
          onPlaceSelected?.({
            geometry: {
              location: new window.google.maps.LatLng(lat, lng)
            },
            name: query
          });
          return;
        }
      }
    }

    // 2. Search local polygons & features in useMapStore
    const features = useMapStore.getState().features;
    const lowerQuery = query.toLowerCase();
    const matchedFeature = features.find(f => {
      const d = f.data || {};
      const name = (d.name || '').toLowerCase();
      const loc = (d.location || '').toLowerCase();
      const landmark = (d.landmark || '').toLowerCase();
      const project = (d.project || '').toLowerCase();
      const tp = (d.tp || '').toLowerCase();
      const op = (d.op || '').toLowerCase();
      const fp = (d.fp || '').toLowerCase();

      return (name && name !== 'polygon' && name !== 'marker' && name.includes(lowerQuery)) ||
        (loc && loc.includes(lowerQuery)) ||
        (landmark && landmark.includes(lowerQuery)) ||
        (project && project.includes(lowerQuery)) ||
        (tp && lowerQuery.includes(tp)) ||
        (fp && lowerQuery.includes(fp)) ||
        (op && lowerQuery.includes(op));
    });

    if (matchedFeature) {
      let center = matchedFeature.center || matchedFeature.position;
      if (!center && matchedFeature.coordinates && matchedFeature.coordinates.length >= 3) {
        const lats = matchedFeature.coordinates.map(c => c.lat);
        const lngs = matchedFeature.coordinates.map(c => c.lng);
        center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
      }

      if (center && window.google?.maps?.LatLng) {
        onPlaceSelected?.({
          geometry: {
            location: new window.google.maps.LatLng(center.lat, center.lng)
          },
          name: matchedFeature.data?.name || query,
          matchedFeature
        });
        return;
      }
    }

    // 3. Fallback to Google Maps Geocoder API
    if (window.google?.maps?.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results && results[0]?.geometry?.location) {
          onPlaceSelected?.(results[0]);
        } else {
          toast.error(`No location found for "${query}"`);
        }
      });
    }
  }, [onPlaceSelected]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch(searchValue || e.target.value);
    }
  }, [executeSearch, searchValue]);

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    onPlaceSelected?.(null);
  }, [onPlaceSelected]);

  return (
    <div
      className="search-box-container"
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        width: 'min(480px, calc(100% - 32px))',
        maxWidth: 480,
        paddingTop: 4,
        ...containerStyle
      }}
    >
      <Autocomplete onLoad={handleLoad} onPlaceChanged={handlePlaceChanged}>
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="text"
            placeholder={placeholder}
            style={{
              ...inputStyle,
              paddingRight: searchValue ? 40 : 20
            }}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {searchValue && (
            <button
              type="button"
              onClick={handleClearSearch}
              title="Clear search"
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#94a3b8',
                transition: 'all 0.2s',
                padding: 0
              }}
              className="btn-hover-effect"
            >
              <FiX size={14} color="#f8fafc" />
            </button>
          )}
        </div>
      </Autocomplete>
    </div>
  );
}

export default SearchBox;
