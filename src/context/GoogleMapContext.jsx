import { createContext, useContext, useState } from 'react';

const GoogleMapContext = createContext(null);

export function GoogleMapProvider({ children }) {
  const [map, setMap] = useState(null);

  return (
    <GoogleMapContext.Provider value={{ map, setMap }}>
      {children}
    </GoogleMapContext.Provider>
  );
}

export function useGoogleMap() {
  const context = useContext(GoogleMapContext);
  if (context === undefined) {
    throw new Error('useGoogleMap must be used within a GoogleMapProvider');
  }
  return context.map;
}

export function useSetGoogleMap() {
  const context = useContext(GoogleMapContext);
  if (context === undefined) {
    throw new Error('useSetGoogleMap must be used within a GoogleMapProvider');
  }
  return context.setMap;
}
