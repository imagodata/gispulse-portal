import { type ReactNode, useState, useCallback } from "react"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Circle, Square, Minus, Shapes, Trash2, Download, Zap } from "lucide-react"
import { toast } from "sonner"
import { useDatasetStore } from "@/stores/datasetStore"
import { useMapViewStore, layerKey } from "@/stores/mapViewStore"
import { deleteDatasetApi, exportGpkg } from "@/api/client"
import type { ComputedField } from "@/api/relations"

const GEOMETRY_STYLES: Record<
  string,
  { color: string; bg: string; darkBg: string; icon: ReactNode }
> = {
  polygon: {
    color: "blue",
    bg: "bg-blue-50",
    darkBg: "dark:bg-blue-950",
    icon: <Square size={14} />,
  },
  multipolygon: {
    color: "blue",
    bg: "bg-blue-50",
    darkBg: "dark:bg-blue-950",
    icon: <Square size={14} />,
  },
  linestring: {
    color: "emerald",
    bg: "bg-emerald-50",
    darkBg: "dark:bg-emerald-950",
    icon: <Minus size={14} />,
  },
  multilinestring: {
    color: "emerald",
    bg: "bg-emerald-50",
    darkBg: "dark:bg-emerald-950",
    icon: <Minus size={14} />,
  },
  point: {
    color: "amber",
    bg: "bg-amber-50",
    darkBg: "dark:bg-amber-950",
    icon: <Circle size={14} />,
  },
  multipoint: {
    color: "amber",
    bg: "bg-amber-50",
    darkBg: "dark:bg-amber-950",
    icon: <Circle size={14} />,
  },
}

const DEFAULT_STYLE: { color: string; bg: string; darkBg: string; icon: ReactNode } = {
  color: "slate",
  bg: "bg-slate-50",
  darkBg: "dark:bg-slate-950",
  icon: <Shapes size={14} />,
}

export interface SchemaLayerData {
  datasetId: string
  layerName: string
  geometryType: string | null
  featureCount: number
  datasetName: string
  fields: { name: string; type: string }[]
  /** Computed fields from relations (injected by SchemaView) */
  computedFields?: ComputedField[]
}

interface NodeContextMenu {
  x: number
  y: number
}

const BORDER_CLASSES: Record<string, string> = {
  blue: "border-blue-500",
  emerald: "border-emerald-500",
  amber: "border-amber-500",
  slate: "border-slate-500",
}

const HANDLE_CLASSES: Record<string, string> = {
  blue: "!bg-blue-500",
  emerald: "!bg-emerald-500",
  amber: "!bg-amber-500",
  slate: "!bg-slate-500",
}

const LABEL_CLASSES: Record<string, string> = {
  blue: "text-blue-600 dark:text-blue-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  slate: "text-slate-600 dark:text-slate-400",
}

const FIELD_TYPE_BADGE: Record<string, string> = {
  int: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  float:
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  str: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  datetime:
    "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  bool: "bg-lime-100 text-lime-700 dark:bg-lime-900 dark:text-lime-300",
}

const DEFAULT_FIELD_TYPE_BADGE =
  "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"

const COMPUTED_FIELD_BADGE =
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"

const MAX_VISIBLE_FIELDS = 8

export function SchemaLayerNode({ data }: NodeProps) {
  const d = data as unknown as SchemaLayerData
  const geomKey = (d.geometryType ?? "").toLowerCase()
  const style = GEOMETRY_STYLES[geomKey] ?? DEFAULT_STYLE
  const borderClass = BORDER_CLASSES[style.color] ?? BORDER_CLASSES.slate
  const handleClass = HANDLE_CLASSES[style.color] ?? HANDLE_CLASSES.slate
  const labelClass = LABEL_CLASSES[style.color] ?? LABEL_CLASSES.slate
  const fields = d.fields ?? []
  const computedFields = d.computedFields ?? []
  const allFields = [
    ...fields,
    ...computedFields.map((cf) => ({ name: cf.name, type: "computed" })),
  ]
  const visibleFields = allFields.slice(0, MAX_VISIBLE_FIELDS)
  const hiddenCount = allFields.length - visibleFields.length
  const computedNames = new Set(computedFields.map((cf) => cf.name))

  const [ctxMenu, setCtxMenu] = useState<NodeContextMenu | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const removeDataset = useDatasetStore((s) => s.removeDataset)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const handleDelete = useCallback(() => {
    setCtxMenu(null)
    setShowDeleteConfirm(true)
  }, [])

  const confirmDelete = useCallback(async () => {
    try {
      await deleteDatasetApi(d.datasetId)
      removeDataset(d.datasetId)
      const remaining = useDatasetStore.getState().datasets
      const validKeys = new Set<string>()
      for (const ds of remaining) {
        for (const l of ds.layers ?? []) validKeys.add(layerKey(ds.id, l.name))
      }
      useMapViewStore.getState().cleanupOrphanedLayers(validKeys)
      toast.success(`Dataset "${d.datasetName}" deleted`)
    } catch (err) {
      toast.error("Delete failed: " + (err instanceof Error ? err.message : String(err)))
    }
    setShowDeleteConfirm(false)
  }, [d.datasetId, d.datasetName, removeDataset])

  const handleExport = useCallback(async () => {
    setCtxMenu(null)
    const ds = useDatasetStore.getState().datasets.find((ds) => ds.id === d.datasetId)
    if (!ds) return
    const layers = (ds.layers ?? []).map((l) => ({
      datasetId: ds.id,
      layerName: l.name,
    }))
    try {
      await exportGpkg(layers, `${d.datasetName}.gpkg`)
      toast.success("Export started")
    } catch (err) {
      toast.error("Export failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }, [d.datasetId, d.datasetName])

  return (
    <>
    <div
      onContextMenu={handleContextMenu}
      className={`rounded-lg border-2 ${borderClass} ${style.bg} ${style.darkBg} shadow-sm min-w-[220px] max-w-[280px]`}
    >
      {/* Geometry handle — left (target) */}
      <Handle
        type="target"
        position={Position.Left}
        id="geom-in"
        className={`!w-2.5 !h-2.5 ${handleClass} !border-2 !border-white dark:!border-gray-900`}
        style={{ top: 30 }}
      />
      {/* Geometry handle — right (source) */}
      <Handle
        type="source"
        position={Position.Right}
        id="geom-out"
        className={`!w-2.5 !h-2.5 ${handleClass} !border-2 !border-white dark:!border-gray-900`}
        style={{ top: 30 }}
      />

      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50">
        <div
          className={`text-label-sm font-semibold uppercase tracking-wider ${labelClass} mb-0.5`}
        >
          {d.datasetName}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm" title={d.geometryType ?? "Unknown"}>
            {style.icon}
          </span>
          <span className="text-sm font-semibold text-foreground truncate">
            {d.layerName}
          </span>
          {computedFields.length > 0 && (
            <span className="ml-auto flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400" title={`${computedFields.length} computed field(s)`}>
              <Zap size={10} />
              <span className="text-label-sm font-medium">{computedFields.length}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-label text-muted-foreground">
          <span>
            {d.featureCount.toLocaleString()}{" "}
            {d.featureCount === 1 ? "feature" : "features"}
          </span>
          {d.geometryType && (
            <>
              <span className="text-border">|</span>
              <span>{d.geometryType}</span>
            </>
          )}
        </div>
      </div>

      {/* Fields with per-field handles */}
      {allFields.length > 0 && (
        <div className="relative py-1.5 max-h-[220px] overflow-y-auto">
          {visibleFields.map((f) => {
            const isComputed = computedNames.has(f.name)

            return (
              <div
                key={f.name}
                className="flex items-center justify-between gap-2 py-0.5 px-3 relative group"
              >
                {/* Field-level handle (right side, source) — positioned relative to row */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`field-${f.name}`}
                  className="!w-1.5 !h-1.5 !bg-gray-400 group-hover:!bg-violet-500 !border !border-white dark:!border-gray-900 !right-[-5px] !translate-y-0 transition-colors"
                  style={{ top: "50%", position: "absolute", transform: "translateY(-50%)" }}
                />
                {/* Field-level handle (left side, target) — positioned relative to row */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`field-${f.name}-in`}
                  className="!w-1.5 !h-1.5 !bg-gray-400 group-hover:!bg-violet-500 !border !border-white dark:!border-gray-900 !left-[-5px] !translate-y-0 transition-colors"
                  style={{ top: "50%", position: "absolute", transform: "translateY(-50%)" }}
                />

                <span className={`text-label-lg font-mono truncate ${isComputed ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
                  {isComputed && <Zap size={9} className="inline mr-0.5 mb-px" />}
                  {f.name}
                </span>
                <span
                  className={`text-label-sm font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                    isComputed
                      ? COMPUTED_FIELD_BADGE
                      : FIELD_TYPE_BADGE[f.type] ?? DEFAULT_FIELD_TYPE_BADGE
                  }`}
                >
                  {isComputed ? "auto" : f.type}
                </span>
              </div>
            )
          })}
          {hiddenCount > 0 && (
            <div className="text-label text-muted-foreground pt-0.5 px-3">
              + {hiddenCount} more field{hiddenCount > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Empty fields state */}
      {allFields.length === 0 && (
        <div className="px-3 py-2 text-label text-muted-foreground italic">
          No fields
        </div>
      )}
    </div>

    {/* Context menu */}
    {ctxMenu && (
      <>
        <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} />
        <div
          className="fixed z-50 min-w-[180px] rounded-md border bg-popover py-1 shadow-md text-xs"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors"
            onClick={handleExport}
          >
            <Download size={12} /> Export as GPKG
          </button>
          <div className="h-px bg-border my-1" />
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-destructive transition-colors"
            onClick={handleDelete}
          >
            <Trash2 size={12} /> Delete dataset
          </button>
        </div>
      </>
    )}
    <ConfirmDialog
      open={showDeleteConfirm}
      title="Delete dataset?"
      description={`This will permanently remove "${d.datasetName}" and its data. This action cannot be undone.`}
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={confirmDelete}
      onCancel={() => setShowDeleteConfirm(false)}
    />
    </>
  )
}
