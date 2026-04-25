/**
 * FeatureInspector — Issue #139 (Sprint R-5)
 *
 * Panneau latéral ou flottant affichant les attributs d'une feature
 * cliquée sur la carte.
 *
 * Données passées via le store (featureInspectorStore) alimenté par
 * le handler click de MapView.
 *
 * Actions disponibles :
 *   - Zoom to feature (fitBounds)
 *   - Copy GeoJSON
 *   - Edit properties (déclenche PUT /features/{layer}/{fid})
 *   - Delete feature (déclenche DELETE /features/{layer}/{fid})
 *   - Navigate prev/next entre features cliquées consécutives
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  XIcon,
  ZoomInIcon,
  ClipboardCopyIcon,
  PencilIcon,
  Trash2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
} from "lucide-react"
import { toast } from "sonner"
import { create } from "zustand"
import { cn } from "@/lib/utils"
import { useMapStore } from "@/stores/mapStore"
import { updateFeatureApi } from "@/api/client"

// ---------------------------------------------------------------------------
// Feature inspector store — shared between MapView (writer) and this component
// ---------------------------------------------------------------------------

export interface InspectedFeature {
  fid: number
  layerName: string
  datasetId: string
  properties: Record<string, unknown>
  geometry: Record<string, unknown> | null
  geometryType: string | null
}

interface FeatureInspectorState {
  history: InspectedFeature[]        // navigation history
  historyIndex: number               // current position
  open: boolean
  push: (feat: InspectedFeature) => void
  prev: () => void
  next: () => void
  close: () => void
  updateCurrentProperties: (props: Record<string, unknown>) => void
}

export const useFeatureInspectorStore = create<FeatureInspectorState>((set, _get) => ({
  history: [],
  historyIndex: -1,
  open: false,

  push: (feat) =>
    set((s) => {
      // Truncate forward history if we navigated back
      const truncated = s.history.slice(0, s.historyIndex + 1)
      const next = [...truncated, feat]
      return { history: next, historyIndex: next.length - 1, open: true }
    }),

  prev: () =>
    set((s) =>
      s.historyIndex > 0
        ? { historyIndex: s.historyIndex - 1 }
        : s,
    ),

  next: () =>
    set((s) =>
      s.historyIndex < s.history.length - 1
        ? { historyIndex: s.historyIndex + 1 }
        : s,
    ),

  close: () => set({ open: false }),

  updateCurrentProperties: (props) =>
    set((s) => {
      const idx = s.historyIndex
      if (idx < 0) return s
      const next = [...s.history]
      next[idx] = { ...next[idx], properties: { ...next[idx].properties, ...props } }
      return { history: next }
    }),
}))

// ---------------------------------------------------------------------------
// FeatureInspector component
// ---------------------------------------------------------------------------

function ValueCell({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="italic text-muted-foreground/60">null</span>
  }
  if (typeof value === "boolean") {
    return (
      <span className={cn("font-mono text-xs", value ? "text-green-600" : "text-red-500")}>
        {String(value)}
      </span>
    )
  }
  if (typeof value === "number") {
    return <span className="font-mono text-xs">{value}</span>
  }
  const str = String(value)
  if (str.length > 80) {
    return (
      <span className="font-mono text-xs truncate block max-w-[180px]" title={str}>
        {str}
      </span>
    )
  }
  return <span className="font-mono text-xs break-all">{str}</span>
}

interface EditState {
  key: string
  value: string
}

export function FeatureInspector() {
  const { history, historyIndex, open, prev, next, close, updateCurrentProperties } =
    useFeatureInspectorStore()
  const map = useMapStore((s) => s.map)

  const current = history[historyIndex] ?? null

  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) editInputRef.current?.focus()
  }, [editing])

  const handleZoom = useCallback(() => {
    if (!current || !map || !current.geometry) return
    try {
      // Compute bbox from geometry
      const coords: number[][] = []
      function extractCoords(g: Record<string, unknown>) {
        const type = g.type as string
        const c = g.coordinates as unknown
        if (type === "Point") {
          coords.push(c as number[])
        } else if (type === "MultiPoint" || type === "LineString") {
          ;(c as number[][]).forEach((p) => coords.push(p))
        } else if (type === "MultiLineString" || type === "Polygon") {
          ;(c as number[][][]).forEach((ring) => ring.forEach((p) => coords.push(p)))
        } else if (type === "MultiPolygon") {
          ;(c as number[][][][]).forEach((poly) => poly.forEach((ring) => ring.forEach((p) => coords.push(p))))
        }
      }
      extractCoords(current.geometry)
      if (coords.length === 0) return
      const lngs = coords.map((c) => c[0])
      const lats = coords.map((c) => c[1])
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 80 },
      )
    } catch {
      // ignore
    }
  }, [current, map])

  const handleCopyGeoJSON = useCallback(() => {
    if (!current) return
    const feature = {
      type: "Feature",
      geometry: current.geometry,
      properties: current.properties,
    }
    navigator.clipboard.writeText(JSON.stringify(feature, null, 2)).then(
      () => toast.success("GeoJSON copied to clipboard"),
      () => toast.error("Clipboard copy failed"),
    )
  }, [current])

  const startEdit = useCallback((key: string, value: unknown) => {
    setEditing({ key, value: value === null || value === undefined ? "" : String(value) })
  }, [])

  const commitEdit = useCallback(async () => {
    if (!editing || !current) return
    const newProps = { [editing.key]: editing.value }
    setSaving(true)
    try {
      await updateFeatureApi(current.datasetId, current.layerName, current.fid, {
        properties: newProps,
      })
      updateCurrentProperties(newProps)
      toast.success(`"${editing.key}" updated`)
    } catch (err) {
      toast.error("Update failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
      setEditing(null)
    }
  }, [editing, current, updateCurrentProperties])

  const handleDelete = useCallback(async () => {
    if (!current) return
    if (!confirm(`Delete feature ${current.fid} from "${current.layerName}"?`)) return
    setDeleting(true)
    try {
      // Use portal PUT endpoint with empty body to signal delete via dedicated approach
      // Actual delete goes through the existing /features/{layer}/{fid} endpoint
      const res = await fetch(
        `/api/portal/datasets/${current.datasetId}/layers/${encodeURIComponent(current.layerName)}/features/${current.fid}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
      toast.success("Feature deleted")
      close()
    } catch (err) {
      toast.error("Delete failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setDeleting(false)
    }
  }, [current, close])

  if (!open || !current) return null

  const entries = Object.entries(current.properties)

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-l bg-background text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex flex-col">
          <span className="font-semibold text-sm">Feature #{current.fid}</span>
          <span className="text-label text-muted-foreground truncate max-w-[160px]">
            {current.layerName}
            {current.geometryType ? ` · ${current.geometryType}` : ""}
          </span>
        </div>
        <button
          onClick={close}
          className="rounded p-0.5 hover:bg-accent"
          title="Close inspector"
          aria-label="Close feature inspector"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <button
          onClick={handleZoom}
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-accent text-label"
          title="Zoom to feature"
          disabled={!current.geometry}
        >
          <ZoomInIcon className="h-3.5 w-3.5" />
          Zoom
        </button>
        <button
          onClick={handleCopyGeoJSON}
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-accent text-label"
          title="Copy as GeoJSON"
        >
          <ClipboardCopyIcon className="h-3.5 w-3.5" />
          Copy
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-red-100 hover:text-red-700 text-label disabled:opacity-50"
          title="Delete feature"
        >
          <Trash2Icon className="h-3.5 w-3.5" />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>

      {/* Properties table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-1 text-left text-label font-medium text-muted-foreground uppercase tracking-wide w-1/3">
                Field
              </th>
              <th className="px-2 py-1 text-left text-label font-medium text-muted-foreground uppercase tracking-wide">
                Value
              </th>
              <th className="w-6" aria-label="Edit" />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-1">
                    <span>No attributes</span>
                    {current.geometryType && (
                      <span className="text-label text-muted-foreground/60">
                        Geometry: {current.geometryType}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            )}
            {entries.map(([key, value]) => (
              <tr key={key} className="border-b hover:bg-muted/30 group">
                <td className="px-2 py-1 font-medium text-muted-foreground truncate max-w-[80px]" title={key}>
                  {key}
                </td>
                <td className="px-2 py-1">
                  {editing?.key === key ? (
                    <div className="flex items-center gap-1">
                      <input
                        ref={editInputRef}
                        value={editing.value}
                        onChange={(e) => setEditing({ key, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit()
                          if (e.key === "Escape") setEditing(null)
                        }}
                        className="flex-1 rounded border px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring bg-background"
                        disabled={saving}
                      />
                      <button
                        onClick={commitEdit}
                        disabled={saving}
                        className="text-green-600 hover:text-green-700 disabled:opacity-50"
                        title="Save"
                      >
                        <CheckIcon className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Cancel"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <ValueCell value={value} />
                  )}
                </td>
                <td className="px-1">
                  {editing?.key !== key && (
                    <button
                      onClick={() => startEdit(key, value)}
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-accent text-muted-foreground transition-opacity"
                      title={`Edit ${key}`}
                    >
                      <PencilIcon className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Navigation prev/next */}
      {history.length > 1 && (
        <div className="flex items-center justify-between border-t px-2 py-1.5">
          <button
            onClick={prev}
            disabled={historyIndex === 0}
            className="flex items-center gap-1 rounded px-2 py-1 hover:bg-accent disabled:opacity-40 text-label"
            title="Previous feature"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            Prev
          </button>
          <span className="text-label text-muted-foreground">
            {historyIndex + 1} / {history.length}
          </span>
          <button
            onClick={next}
            disabled={historyIndex === history.length - 1}
            className="flex items-center gap-1 rounded px-2 py-1 hover:bg-accent disabled:opacity-40 text-label"
            title="Next feature"
          >
            Next
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
