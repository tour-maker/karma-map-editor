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
  // Small clickable dots at each already-placed vertex while actively
  // drawing (not the same as the editable drag-handles Google shows after
  // the polygon is completed) — hover highlights them red, click removes
  // that specific point, so a misplaced point doesn't require cancelling
  // and redrawing the whole shape.
  const vertexMarkersRef = useRef([])
  // Index of the vertex dot currently under the cursor (or null), so the
  // Delete/Backspace key can remove that specific point without needing a
  // click.
  const hoveredVertexIndexRef = useRef(null)
  // True while a vertex dot is being drag-repositioned. The dots sit exactly
  // on top of each vertex (so they can also be hovered/clicked to delete),
  // which otherwise blocks Google's own editable drag-handles underneath —
  // so the dots themselves are made draggable and drive the path directly.
  // While a drag is in progress we skip the usual "rebuild all dots on any
  // path change" reaction, since destroying/recreating the marker mid-drag
  // would cancel the browser's drag gesture.
  const isDraggingVertexRef = useRef(false)

  useImperativeHandle(ref, () => ({
    startDrawing: () => {
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

  const clearVertexMarkers = useCallback(() => {
    vertexMarkersRef.current.forEach((marker) => marker.setMap(null))
    vertexMarkersRef.current = []
    hoveredVertexIndexRef.current = null
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
    clearVertexMarkers()

    if (polygon) {
      if (shouldRemoveFromMap && polygon.getMap()) {
        polygon.setMap(null)
      }
      activePolygonRef.current = null
    }

    suppressNextClickRef.current = false
  }, [removeActivePolygonListeners, clearVertexMarkers])

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
    clearVertexMarkers()
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
  }, [clearActivePolygon, onPolygonComplete, removePathListeners, clearVertexMarkers, appMode])

  // Redraws the small hover-to-delete dots at every current vertex — called
  // whenever the in-progress path changes (a point added, undone, or
  // deleted), so the markers always match what's actually on the map.
  // Rebuilding from scratch each time (rather than diffing) is simple and
  // cheap at the vertex counts a plot polygon actually has.
  const rebuildVertexMarkers = useCallback(() => {
    const polygon = activePolygonRef.current
    const googleMaps = window.google?.maps
    if (!polygon || !googleMaps || polygon.isCompleted || !map) {
      clearVertexMarkers()
      return
    }

    clearVertexMarkers()

    const path = polygon.getPath()
    const length = path.getLength()
    const dotIcon = (highlighted) => ({
      path: googleMaps.SymbolPath.CIRCLE,
      scale: highlighted ? 8 : 6,
      fillColor: highlighted ? '#ef4444' : '#ffffff',
      fillOpacity: 1,
      strokeColor: highlighted ? '#ffffff' : '#2563eb',
      strokeWeight: 2
    })

    for (let i = 0; i < length; i++) {
      const isFirstVertex = i === 0
      const marker = new googleMaps.Marker({
        position: path.getAt(i),
        map,
        clickable: true,
        draggable: true,
        cursor: 'pointer',
        zIndex: 1000,
        icon: dotIcon(false),
        title: isFirstVertex && length >= MIN_VERTICES_BEFORE_CLOSE
          ? 'Drag to move, click to close the shape (or hover + press Delete to remove this point)'
          : 'Drag to move, click, or hover + press Delete/Backspace, to remove this point'
      })

      marker.addListener('mouseover', () => {
        hoveredVertexIndexRef.current = i
        marker.setIcon(dotIcon(true))
      })
      marker.addListener('mouseout', () => {
        if (hoveredVertexIndexRef.current === i) hoveredVertexIndexRef.current = null
        marker.setIcon(dotIcon(false))
      })
      marker.addListener('click', () => {
        const currentPolygon = activePolygonRef.current
        if (!currentPolygon || currentPolygon.isCompleted) return
        const currentPath = currentPolygon.getPath()

        // Clicking the very first vertex's dot closes the loop — the same
        // gesture that clicking the map near it already triggered, now with
        // an actual target to click since a marker sits there.
        if (isFirstVertex && currentPath.getLength() >= MIN_VERTICES_BEFORE_CLOSE) {
          finishPolygon()
          return
        }

        if (i < currentPath.getLength()) {
          currentPath.removeAt(i)
        }
      })

      // Dragging the dot repositions this exact vertex. Updating the path
      // live on every 'drag' tick keeps the polygon's shape following the
      // cursor; the rebuild-on-path-change reaction is suppressed for the
      // duration (see isDraggingVertexRef) so this marker isn't torn down
      // mid-gesture, then explicitly resynced once the drag ends.
      marker.addListener('dragstart', () => {
        isDraggingVertexRef.current = true
        hoveredVertexIndexRef.current = i
      })
      marker.addListener('drag', (event) => {
        const currentPolygon = activePolygonRef.current
        if (!currentPolygon || currentPolygon.isCompleted) return
        const currentPath = currentPolygon.getPath()
        if (i < currentPath.getLength()) {
          currentPath.setAt(i, event.latLng)
        }
      })
      marker.addListener('dragend', () => {
        isDraggingVertexRef.current = false
        rebuildVertexMarkers()
      })

      vertexMarkersRef.current.push(marker)
    }
  }, [map, clearVertexMarkers, finishPolygon])

  // Ctrl/Cmd+Z while drawing removes the most recently placed point instead
  // of the whole shape, so one wrong click doesn't mean cancelling and
  // starting over.
  const undoLastPoint = useCallback(() => {
    const polygon = activePolygonRef.current
    if (!polygon || polygon.isCompleted) return
    const path = polygon.getPath()
    if (path.getLength() === 0) return
    path.removeAt(path.getLength() - 1)
  }, [])

  // Delete/Backspace while hovering a vertex dot removes that specific
  // point, no click needed — an alternative to clicking the dot directly.
  const deleteHoveredVertex = useCallback(() => {
    const index = hoveredVertexIndexRef.current
    if (index === null) return false
    const polygon = activePolygonRef.current
    if (!polygon || polygon.isCompleted) return false
    const path = polygon.getPath()
    if (index >= path.getLength()) return false
    path.removeAt(index)
    return true
  }, [])

  useEffect(() => {
    if (!map || !isDrawing) {
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

    // Keeps the hover-to-delete vertex dots in sync with the path for every
    // point added, undone (Ctrl/Cmd+Z), or deleted by clicking a dot.
    const initialPath = polygon.getPath()
    const rebuildUnlessDragging = () => {
      if (isDraggingVertexRef.current) return
      rebuildVertexMarkers()
    }
    pathListenerRefs.current = [
      googleMaps.event.addListener(initialPath, 'insert_at', rebuildUnlessDragging),
      googleMaps.event.addListener(initialPath, 'remove_at', rebuildUnlessDragging),
      googleMaps.event.addListener(initialPath, 'set_at', rebuildUnlessDragging)
    ]

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
      clearVertexMarkers()
      if (activePolygonRef.current && !activePolygonRef.current.isCompleted) {
        removePathListeners()
        activePolygonRef.current.setMap(null)
      }
      activePolygonRef.current = null
      suppressNextClickRef.current = false
    }
  }, [clearActivePolygon, finishPolygon, isDrawing, map, removeMapListeners, removePathListeners, clearVertexMarkers, rebuildVertexMarkers, appMode])

  useEffect(() => {
    return () => {
      removeActivePolygonListeners()
      clearVertexMarkers()
      if (activePolygonRef.current) {
        activePolygonRef.current.setMap(null)
      }
      activePolygonRef.current = null
      suppressNextClickRef.current = false
    }
  }, [removeActivePolygonListeners, clearVertexMarkers])

  // Ctrl/Cmd+Z removes the last placed point instead of the browser's own
  // undo. Delete/Backspace while hovering a vertex dot removes that specific
  // point instead (falls through to the same last-point undo if nothing's
  // currently hovered, since Delete/Backspace with no target selected is a
  // reasonable "undo the last thing I did" too).
  useEffect(() => {
    if (!isDrawing) return undefined

    function handleKeyDown(event) {
      const isUndoCombo = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z'
      const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'
      if (!isUndoCombo && !isDeleteKey) return

      // Don't hijack these while the user is actually typing somewhere
      // (e.g. renaming something in a text field left open elsewhere) —
      // Backspace in particular needs this guard, since it's a normal
      // editing key everywhere else on the page.
      const activeTag = document.activeElement?.tagName
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable) return

      if (isUndoCombo) {
        event.preventDefault()
        undoLastPoint()
        return
      }

      // isDeleteKey: remove the hovered point if there is one, otherwise
      // behave like Ctrl/Cmd+Z and undo the last placed point.
      event.preventDefault()
      if (!deleteHoveredVertex()) undoLastPoint()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDrawing, undoLastPoint, deleteHoveredVertex])

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
        onClick={undoLastPoint}
        title="Undo last point (Ctrl/Cmd+Z) — or click any dot on the shape to remove that point"
        style={{
          background: 'transparent', border: 'none', color: '#64748b', fontSize: 13,
          fontWeight: 500, cursor: 'pointer', padding: '4px 8px', borderRadius: 4
        }}
      >
        Undo Point
      </button>
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

