/**
 * LayerItemButton — Individual layer row in the layer tree.
 *
 * Extracted from LeftPanel.tsx (#408).
 * Features: visibility toggle, color picker, inline rename, opacity slider,
 * context menu, drag-and-drop, zoom to extent, solo, delete.
 */

import { useCallback, useRef, useState } from "react"
import { Eye, EyeOff, Crosshair, Focus, Trash2, Database, Paintbrush } from "lucide-react"
import { toast } from "sonner"
import { IconButton } from "@/components/ui/icon-button"
import { useMapViewStore } from "@/stores/mapViewStore"
import { useMapStore } from "@/stores/mapStore"
import { LayerColorPicker } from "../LayerColorPicker"
import { GeomIcon } from "./GeomIcon"
import { LayerContextMenu } from "./LayerContextMenu"

export interface LayerEntry {
  ds: {
    id: string
    source_type?: string
    layers: {
      name: string
      geometry_type: string | null
      feature_count: number
      bbox?: [number, number, number, number]
    }[]
  }
  layer: {
    name: string
    geometry_type: string | null
    feature_count: number
    bbox?: [number, number, number, number]
  }
}

export interface LayerItemButtonProps {
  layerKey: string
  entry: LayerEntry
  layerVisibility: Record<string, { visible?: boolean; opacity?: number; color?: string; displayName?: string; strokeColor?: string; strokeWidth?: number }>
  selectedDatasetId: string | null
  selectedLayerName: string | null
  selectLayer: (dsId: string, name: string) => void
  setContextSelection: (sel: any) => void
  setLayerVisible: (key: string, visible: boolean) => void
  setLayerColor: (key: string, color: string) => void
  setLayerOpacity: (key: string, opacity: number) => void
  layerGroups: Record<string, { name: string; collapsed: boolean; layers: string[] }>
  triggerCount?: number
  isMultiSelected?: boolean
  isFocused?: boolean
  onSelectWithModifiers?: (key: string, e: React.MouseEvent) => void
  onOpenStyleEditor?: (key: string) => void
}

export function LayerItemButton({
  layerKey: key,
  entry,
  layerVisibility,
  selectedDatasetId,
  selectedLayerName,
  selectLayer,
  setContextSelection,
  setLayerVisible,
  setLayerColor,
  setLayerOpacity,
  layerGroups,
  triggerCount = 0,
  isMultiSelected = false,
  isFocused = false,
  onSelectWithModifiers,
  onOpenStyleEditor,
}: LayerItemButtonProps) {
  const { ds, layer } = entry
  const vis = layerVisibility[key]
  const isVisible = vis?.visible ?? true
  const isSelected = selectedDatasetId === ds.id && selectedLayerName === layer.name
  const color = vis?.color ?? "#3b82f6"
  const opacity = vis?.opacity ?? 0.7
  const displayName = vis?.displayName || layer.name
  const isSession = ds.source_type === "session"
  const [hovered, setHovered] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState("")
  const renameRef = useRef<HTMLInputElement>(null)
  const zoomToExtent = useMapStore((s) => s.zoomToExtent)
  const soloLayer = useMapViewStore((s) => s.soloLayer)
  const removeLayer = useMapViewStore((s) => s.removeLayer)
  const setLayerDisplayName = useMapViewStore((s) => s.setLayerDisplayName)

  const bbox = layer.bbox ?? null

  const startRename = useCallback(() => {
    setRenameDraft(displayName)
    setRenaming(true)
    setTimeout(() => renameRef.current?.select(), 10)
  }, [displayName])

  const commitRename = useCallback(() => {
    const trimmed = renameDraft.trim()
    if (trimmed && trimmed !== layer.name) {
      setLayerDisplayName(key, trimmed)
    } else if (trimmed === layer.name) {
      setLayerDisplayName(key, "")
    }
    setRenaming(false)
  }, [renameDraft, layer.name, key, setLayerDisplayName])

  const handleDelete = useCallback(() => {
    removeLayer(key)
    toast.info(`Layer "${displayName}" removed`, { duration: 3000 })
  }, [key, displayName, removeLayer])

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setCtxMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            if (renaming) return
            if (onSelectWithModifiers) {
              onSelectWithModifiers(key, e)
            } else {
              selectLayer(ds.id, layer.name)
              setContextSelection({ type: "layer", datasetId: ds.id, layerName: layer.name })
            }
          }}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            startRename()
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              if (!renaming) {
                if (onSelectWithModifiers) {
                  onSelectWithModifiers(key, e as any)
                } else {
                  selectLayer(ds.id, layer.name)
                  setContextSelection({ type: "layer", datasetId: ds.id, layerName: layer.name })
                }
              }
            }
          }}
          draggable={!renaming}
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "application/gispulse-layer",
              JSON.stringify({ datasetId: ds.id, layerName: layer.name }),
            )
            e.dataTransfer.effectAllowed = "copy"
          }}
          className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
            isMultiSelected
              ? "bg-primary/20 text-foreground ring-1 ring-primary/30"
              : isSelected
              ? "bg-primary/10 text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }${isFocused ? " outline outline-1 outline-primary/70" : ""}`}
        >
          <IconButton
            label="Toggle visibility"
            onClick={(e) => {
              e.stopPropagation()
              setLayerVisible(key, !isVisible)
            }}
            className={`shrink-0 ${isVisible ? "text-primary" : "text-muted-foreground/40"}`}
          >
            {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
          </IconButton>
          <LayerColorPicker
            color={color}
            opacity={opacity}
            onColorChange={(c) => setLayerColor(key, c)}
            onOpacityChange={(o) => setLayerOpacity(key, o)}
            strokeColor={vis?.strokeColor}
            strokeWidth={vis?.strokeWidth}
            onStrokeColorChange={(c) => useMapViewStore.getState().setLayerStrokeColor(key, c)}
            onStrokeWidthChange={(w) => useMapViewStore.getState().setLayerStrokeWidth(key, w)}
          />
          <GeomIcon type={layer.geometry_type} />
          {isSession && (
            <span title="PostGIS session layer"><Database size={10} className="shrink-0 text-amber-500/70" /></span>
          )}
          {renaming ? (
            <input
              ref={renameRef}
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === "Enter") commitRename()
                if (e.key === "Escape") setRenaming(false)
              }}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
              className="truncate flex-1 text-left text-xs bg-transparent border-b border-primary/50 outline-none px-0.5"
            />
          ) : (
            <span className="truncate flex-1 text-left" title={displayName !== layer.name ? `${displayName} (${layer.name})` : layer.name}>
              {displayName}
            </span>
          )}
          {triggerCount > 0 && !hovered && (
            <span title={`${triggerCount} trigger${triggerCount > 1 ? "s" : ""}`} className="shrink-0 text-label-sm font-medium px-1 py-0.5 rounded bg-violet-500/15 text-violet-500 leading-none">
              {triggerCount}T
            </span>
          )}
          {/* Hover actions: style + zoom + solo + delete */}
          {hovered && !renaming && (
            <span className="flex items-center gap-0.5 shrink-0">
              {onOpenStyleEditor && (
                <IconButton
                  label="Advanced style"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenStyleEditor(key)
                  }}
                  className="text-muted-foreground/60 hover:text-primary"
                >
                  <Paintbrush size={11} />
                </IconButton>
              )}
              {bbox && (
                <IconButton
                  label="Zoom to extent"
                  onClick={(e) => {
                    e.stopPropagation()
                    zoomToExtent(bbox)
                  }}
                  className="text-muted-foreground/60 hover:text-primary"
                >
                  <Crosshair size={11} />
                </IconButton>
              )}
              <IconButton
                label="Solo layer"
                onClick={(e) => {
                  e.stopPropagation()
                  soloLayer(key)
                }}
                className="text-muted-foreground/60 hover:text-primary"
              >
                <Focus size={11} />
              </IconButton>
              <IconButton
                label="Remove layer"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete()
                }}
                className="text-muted-foreground/60 hover:text-destructive"
              >
                <Trash2 size={11} />
              </IconButton>
            </span>
          )}
          {!hovered && (
            <span className="text-label text-muted-foreground/60 shrink-0">
              {layer.feature_count}
            </span>
          )}
        </div>
        {/* Inline opacity slider on hover */}
        {hovered && isVisible && !renaming && (
          <div className="flex items-center gap-1.5 px-2 pb-1">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(opacity * 100)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setLayerOpacity(key, Number(e.target.value) / 100)}
              className="flex-1 h-1 accent-primary cursor-pointer"
              title={`Opacity: ${Math.round(opacity * 100)}%`}
            />
            <span className="text-label-sm text-muted-foreground/60 w-7 text-right tabular-nums">{Math.round(opacity * 100)}%</span>
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <LayerContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          layerKey={key}
          bbox={bbox}
          groupIds={Object.keys(layerGroups)}
          layerGroups={layerGroups}
          onStartRename={startRename}
          onOpenStyleEditor={onOpenStyleEditor ? () => onOpenStyleEditor(key) : undefined}
          datasetId={ds.id}
          layerName={layer.name}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}
