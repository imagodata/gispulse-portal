/**
 * DatasetItem — Collapsible tree node for a dataset in the layer panel.
 *
 * Extracted from LeftPanel.tsx (#408).
 * Shows dataset name, format badge, layer count, context menu (rename/export/delete).
 */

import { useState } from "react"
import { ChevronDown, ChevronRight, Database, FileType } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { useMapViewStore, layerKey } from "@/stores/mapViewStore"
import { useDatasetStore } from "@/stores/datasetStore"
import { deleteDatasetApi, renameDatasetApi, exportGpkg } from "@/api/client"
import { DatasetContextMenu } from "@/components/DatasetContextMenu"
import { RenameDialog } from "@/components/RenameDialog"

export interface DatasetItemProps {
  dataset: {
    id: string
    name: string
    format: string
    source_type?: "project" | "session" | "virtual"
    layers: {
      name: string
      geometry_type: string | null
      feature_count: number
      bbox?: [number, number, number, number]
    }[]
  }
  children: React.ReactNode
}

export function DatasetItem({ dataset, children }: DatasetItemProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [showRename, setShowRename] = useState(false)
  const { removeDataset, renameDataset } = useDatasetStore()
  const layerCount = dataset.layers?.length ?? 0
  const isMultiLayer = layerCount > 1
  const isSession = dataset.source_type === "session"

  const handleDelete = async () => {
    try {
      await deleteDatasetApi(dataset.id)
      removeDataset(dataset.id)
      const datasets = useDatasetStore.getState().datasets
      const validKeys = new Set<string>()
      for (const ds of datasets) {
        for (const l of ds.layers ?? []) validKeys.add(layerKey(ds.id, l.name))
      }
      useMapViewStore.getState().cleanupOrphanedLayers(validKeys)
      toast.success(`Dataset "${dataset.name}" deleted`)
    } catch (err) {
      toast.error("Delete failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleRename = async (newName: string) => {
    if (!newName || newName === dataset.name) {
      setShowRename(false)
      return
    }
    try {
      await renameDatasetApi(dataset.id, newName)
      renameDataset(dataset.id, newName)
      toast.success("Dataset renamed")
    } catch (err) {
      toast.error("Rename failed: " + (err instanceof Error ? err.message : String(err)))
    }
    setShowRename(false)
  }

  const handleExport = async () => {
    const stack = useMapViewStore.getState().views.find((v) => v.id === useMapViewStore.getState().activeViewId)?.state.layerStack ?? []
    const layers = (dataset.layers ?? []).map((l) => {
      const style = stack.find((s) => s.key === layerKey(dataset.id, l.name))
      return {
        datasetId: dataset.id,
        layerName: l.name,
        color: style?.color,
        opacity: style?.opacity,
      }
    })
    try {
      await exportGpkg(layers, `${dataset.name}.gpkg`)
      toast.success("Export started")
    } catch (err) {
      toast.error("Export failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <>
      <div
        className="group"
        onContextMenu={(e) => {
          e.preventDefault()
          setCtxMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/50 rounded-md transition-colors"
        >
          <span className="shrink-0">
            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </span>
          {isMultiLayer
            ? <Database size={12} className={`shrink-0 ${isSession ? "text-orange-500" : "text-primary/60"}`} />
            : <FileType size={12} className="shrink-0 text-muted-foreground/60" />
          }
          <span className="truncate flex-1 text-left">{dataset.name}</span>
          {isSession ? (
            <Badge className="text-label-xs h-3 px-1 shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/20">PG</Badge>
          ) : (
            <Badge variant="outline" className="text-label-xs h-3.5 px-1 shrink-0 uppercase">
              {dataset.format}
            </Badge>
          )}
          {isMultiLayer && (
            <span className="text-label-sm text-muted-foreground/60 shrink-0">{layerCount}L</span>
          )}
        </button>
        {!collapsed && (
          <div className={isMultiLayer ? "ml-3 border-l border-border/40 pl-1" : ""}>
            {children}
          </div>
        )}
      </div>
      {ctxMenu && (
        <DatasetContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onRename={() => setShowRename(true)}
          onExport={handleExport}
          onDelete={handleDelete}
        />
      )}
      {showRename && (
        <RenameDialog
          initialName={dataset.name}
          onConfirm={handleRename}
          onCancel={() => setShowRename(false)}
        />
      )}
    </>
  )
}
