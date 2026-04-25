import { useCallback, useState } from "react"
import { createFeature, deleteFeature } from "@/api/client"
import { toastError } from "@/utils/toast"

export type DrawMode = "none" | "point" | "line" | "polygon" | "delete"

export interface DrawState {
  mode: DrawMode
  points: [number, number][]
  activeLayer: string | null
}

function handleDrawError(err: unknown, action: string) {
  const msg = err instanceof Error ? err.message : String(err)
  toastError(`Draw ${action} failed`, msg)
  console.error(`Draw ${action} error:`, err)
}

export function useDraw() {
  const [state, setState] = useState<DrawState>({
    mode: "none",
    points: [],
    activeLayer: null,
  })

  const setMode = useCallback((mode: DrawMode) => {
    setState((prev) => ({ ...prev, mode, points: [] }))
  }, [])

  const setActiveLayer = useCallback((name: string | null) => {
    setState((prev) => ({ ...prev, activeLayer: name }))
  }, [])

  const addPoint = useCallback((lng: number, lat: number) => {
    setState((prev) => {
      if (prev.mode === "none" || prev.mode === "delete") return prev

      const pts: [number, number][] = [...prev.points, [lng, lat]]

      if (prev.mode === "point" && prev.activeLayer) {
        createFeature(prev.activeLayer, {
          type: "Point",
          coordinates: [lng, lat],
        }).catch((err) => handleDrawError(err, "create point"))
        return { ...prev, points: [] }
      }

      return { ...prev, points: pts }
    })
  }, [])

  const finish = useCallback(() => {
    setState((prev) => {
      if (!prev.activeLayer || prev.points.length === 0) {
        return { ...prev, points: [] }
      }

      if (prev.mode === "line" && prev.points.length >= 2) {
        createFeature(prev.activeLayer, {
          type: "LineString",
          coordinates: prev.points,
        }).catch((err) => handleDrawError(err, "create line"))
      }

      if (prev.mode === "polygon" && prev.points.length >= 3) {
        const closed = [...prev.points, prev.points[0]]
        createFeature(prev.activeLayer, {
          type: "Polygon",
          coordinates: [closed],
        }).catch((err) => handleDrawError(err, "create polygon"))
      }

      return { ...prev, points: [] }
    })
  }, [])

  const handleDelete = useCallback(
    (layerName: string, fid: number) => {
      if (state.mode !== "delete") return
      deleteFeature(layerName, fid).catch((err) => handleDrawError(err, "delete feature"))
    },
    [state.mode],
  )

  const clear = useCallback(() => {
    setState((prev) => ({ ...prev, points: [] }))
  }, [])

  return {
    ...state,
    setMode,
    setActiveLayer,
    addPoint,
    finish,
    handleDelete,
    clear,
  }
}
