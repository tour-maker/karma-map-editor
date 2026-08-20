import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'

// Pixel radius around the first vertex within which a click is treated as
// "close the loop" instead of "place a new vertex".
const CLOSE_LOOP_PIXEL_THRESHOLD = 12
const MIN_VERTICES_BEFORE_CLOSE = 3

function metersPerPixelAt(latitude, zoom) {
  const latRadians = (latitude * Math.PI) / 180
  return (156543.03392 * Math.cos(latRadians)) / Math.pow(2, zoom)
}

const polygonOptions = {
  fillColor: '#2563eb',
  fillOpacity: 0.25,
  strokeColor: '#2563eb',
  strokeWeight: 2,
  clickable: true,
  editable: true,
  zIndex: 1
}

const PolygonDrawingManager = forwardRef(function PolygonDrawingManager(
  { map, onPolygonComplete, onPolygonDeleted, appMode },
  ref
) {
  const [isDrawing, setIsDrawing] = useState(false)
  const activePolygonRef = useRef(null)
  const clickListenerRef = useRef(null)
  const dblClickListenerRef = useRef(null)
  const pathListenerRefs = useRef([])
  const suppressNextClickRef = useRef(false)

  useImperativeHandle(ref, () => ({
    startDrawing: () => {
      if (appMode === 'viewer') return;
      setIsDrawing(true);
    },
    stopDrawing: () => {
      clearActivePolygon(true);
      setIsDrawing(false);
    }
  }));

  const removePathListeners = useCallback(() => {
    pathListenerRefs.current.forEach((listener) => {
      window.google?.maps.event.removeListener(listener)
    })
    pathListenerRefs.current = []
  }, [])

  const removeMapListeners = useCallback(() => {
    if (clickListenerRef.current) {
      window.google?.maps.event.removeListener(clickListenerRef.current)
      clickListenerRef.current = null
    }

    if (dblClickListenerRef.current) {
      window.google?.maps.event.removeListener(dblClickListenerRef.current)
      dblClickListenerRef.current = null
    }
  }, [])

  const removeActivePolygonListeners = useCallback(() => {
    removePathListeners()
    removeMapListeners()
  }, [removeMapListeners, removePathListeners])

  const clearActivePolygon = useCallback((shouldRemoveFromMap = false) => {
    const polygon = activePolygonRef.current
    removeActivePolygonListeners()

    if (polygon) {
      if (shouldRemoveFromMap && polygon.getMap()) {
        polygon.setMap(null)
      }
      activePolygonRef.current = null
    }

    suppressNextClickRef.current = false
  }, [removeActivePolygonListeners])

  const finishPolygon = useCallback(() => {
    const polygon = activePolygonRef.current

    if (!polygon) {
      setIsDrawing(false)
      return
    }

    const path = polygon.getPath()
    if (!path || path.getLength() < 3) {
      clearActivePolygon(true)
      setIsDrawing(false)
      return
    }

    removePathListeners()
    polygon.isCompleted = true
    polygon.setEditable(false)

    const listeners = [
      window.google?.maps.event.addListener(path, 'insert_at', () => {
        onPolygonComplete?.(polygon)
      }),
      window.google?.maps.event.addListener(path, 'remove_at', () => {
        onPolygonComplete?.(polygon)
      }),
      window.google?.maps.event.addListener(path, 'set_at', () => {
        onPolygonComplete?.(polygon)
      })
    ].filter(Boolean)

    pathListenerRefs.current = listeners

    onPolygonComplete?.(polygon)
    setIsDrawing(false)
    suppressNextClickRef.current = false
  }, [clearActivePolygon, onPolygonComplete, removePathListeners, appMode])

  useEffect(() => {
    if (!map || !isDrawing || appMode === 'viewer') {
      return undefined
    }

    const googleMaps = window.google?.maps
    if (!googleMaps) {
      return undefined
    }

    clearActivePolygon(true)

    const polygon = new googleMaps.Polygon({ ...polygonOptions, editable: true })
    polygon.setMap(map)
    polygon.isCompleted = false
    activePolygonRef.current = polygon

    const clickListener = googleMaps.event.addListener(map, 'click', (event) => {
      const activePolygon = activePolygonRef.current
      if (!activePolygon || activePolygon.isCompleted) {
        return
      }

      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false
        return
      }

      if (event.domEvent && event.domEvent.detail > 1) {
        return
      }

      const path = activePolygon.getPath()
      const nextLatLng = event.latLng
      const pathLength = path.getLength()

      if (pathLength >= MIN_VERTICES_BEFORE_CLOSE && googleMaps.geometry?.spherical) {
        const firstPoint = path.getAt(0)
        const distanceMeters = googleMaps.geometry.spherical.computeDistanceBetween(firstPoint, nextLatLng)
        const thresholdMeters = metersPerPixelAt(firstPoint.lat(), map.getZoom()) * CLOSE_LOOP_PIXEL_THRESHOLD

        if (distanceMeters <= thresholdMeters) {
          finishPolygon()
          return
        }
      }

      const lastPoint = pathLength > 0 ? path.getAt(pathLength - 1) : null

      if (lastPoint && lastPoint.lat() === nextLatLng.lat() && lastPoint.lng() === nextLatLng.lng()) {
        return
      }

      path.push(nextLatLng)
    })

    const dblClickListener = googleMaps.event.addListener(map, 'dblclick', () => {
      suppressNextClickRef.current = true
      finishPolygon()
    })

    clickListenerRef.current = clickListener
    dblClickListenerRef.current = dblClickListener

    return () => {
      removeMapListeners()
      if (activePolygonRef.current && !activePolygonRef.current.isCompleted) {
        removePathListeners()
        activePolygonRef.current.setMap(null)
      }
      activePolygonRef.current = null
      suppressNextClickRef.current = false
    }
  }, [clearActivePolygon, finishPolygon, isDrawing, map, removeMapListeners, removePathListeners, appMode])

  useEffect(() => {
    return () => {
      removeActivePolygonListeners()
      if (activePolygonRef.current) {
        activePolygonRef.current.setMap(null)
      }
      activePolygonRef.current = null
      suppressNextClickRef.current = false
    }
  }, [removeActivePolygonListeners])

  if (!isDrawing) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(255,255,255,0.95)',
        padding: '10px 16px',
        borderRadius: 24,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500, color: '#0f172a' }}>Drawing Mode</span>
      <div style={{ width: 1, height: 16, background: '#cbd5e1' }} />
      <button
        type="button"
        onClick={() => {
          clearActivePolygon(true);
          setIsDrawing(false);
        }}
        style={{
          background: 'transparent', border: 'none', color: '#64748b', fontSize: 13,
          fontWeight: 500, cursor: 'pointer', padding: '4px 8px', borderRadius: 4
        }}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={finishPolygon}
        style={{
          background: '#2563eb', border: 'none', color: '#fff', fontSize: 13,
          fontWeight: 500, cursor: 'pointer', padding: '6px 12px', borderRadius: 6
        }}
      >
        Finish
      </button>
    </div>
  )
})

export default PolygonDrawingManager

