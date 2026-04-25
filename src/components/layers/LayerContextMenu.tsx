import { Pencil, Crosshair, Focus, FolderInput, Download, Trash2, X, Copy, ClipboardPaste, Paintbrush } from "lucide-react"
import { toast } from "sonner"
import { useMapViewStore, useActiveLayerStack } from "@/stores/mapViewStore"
import { useMapStore } from "@/stores/mapStore"
import { exportGpkg } from "@/api/client"

export function LayerContextMenu({
  x,
  y,
  layerKey: key,
  bbox,
  groupIds,
  layerGroups,
  onStartRename,
  onOpenStyleEditor,
  datasetId,
  layerName,
  onClose,
}: {
  x: number
  y: number
  layerKey: string
  bbox: [number, number, number, number] | null
  groupIds: string[]
  layerGroups: Record<string, { name: string; collapsed: boolean; layers: string[] }>
  onStartRename?: () => void
  onOpenStyleEditor?: () => void
  datasetId?: string
  layerName?: string
  onClose: () => void
}) {
  const zoomToExtent = useMapStore((s) => s.zoomToExtent)
  const soloLayer = useMapViewStore((s) => s.soloLayer)
  const addLayerToGroup = useMapViewStore((s) => s.addLayerToGroup)
  const removeLayerFromGroup = useMapViewStore((s) => s.removeLayerFromGroup)
  const removeLayer = useMapViewStore((s) => s.removeLayer)
  const copyLayerStyle = useMapViewStore((s) => s.copyLayerStyle)
  const pasteLayerStyle = useMapViewStore((s) => s.pasteLayerStyle)
  const copiedStyle = useMapViewStore((s) => s.copiedStyle)
  const layerStyle = useActiveLayerStack().find((l) => l.key === key)

  const currentGroupId = Object.entries(layerGroups).find(([, g]) => g.layers.includes(key))?.[0] ?? null

  const handleExportLayer = async () => {
    if (!datasetId || !layerName) return
    try {
      await exportGpkg([{
        datasetId,
        layerName,
        color: layerStyle?.color ?? "#3b82f6",
        opacity: layerStyle?.opacity ?? 0.7,
        styleDef: layerStyle?.styleDef as Record<string, unknown> | undefined,
      }], `${layerName}.gpkg`)
      toast.success("Export started")
    } catch (err) {
      toast.error("Export failed: " + (err instanceof Error ? err.message : String(err)))
    }
    onClose()
  }

  const handleRemove = () => {
    removeLayer(key)
    toast.info("Layer removed", { duration: 3000 })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-[180px] rounded-md border bg-popover py-1 shadow-md text-xs"
        style={{ left: x, top: y }}
      >
        {onStartRename && (
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors"
            onClick={() => { onStartRename(); onClose() }}
          >
            <Pencil size={12} /> Rename
          </button>
        )}
        {bbox && (
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors"
            onClick={() => { zoomToExtent(bbox); onClose() }}
          >
            <Crosshair size={12} /> Zoom to extent
          </button>
        )}
        <button
          className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors"
          onClick={() => { soloLayer(key); onClose() }}
        >
          <Focus size={12} /> Solo layer
        </button>
        {onOpenStyleEditor && (
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors"
            onClick={() => { onOpenStyleEditor(); onClose() }}
          >
            <Paintbrush size={12} /> Advanced style
          </button>
        )}
        <div className="h-px bg-border my-1" />
        <button
          className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors"
          onClick={() => { copyLayerStyle(key); toast.success("Style copied"); onClose() }}
        >
          <Copy size={12} /> Copy style
        </button>
        {copiedStyle && (
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors"
            onClick={() => { pasteLayerStyle(key); toast.success("Style applied"); onClose() }}
          >
            <ClipboardPaste size={12} /> Paste style
          </button>
        )}
        {datasetId && layerName && (
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors"
            onClick={handleExportLayer}
          >
            <Download size={12} /> Export as GPKG
          </button>
        )}
        {groupIds.length > 0 && !currentGroupId && (
          <>
            <div className="h-px bg-border my-1" />
            {groupIds.map((gid) => (
              <button
                key={gid}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors"
                onClick={() => { addLayerToGroup(gid, key); onClose() }}
              >
                <FolderInput size={12} /> Add to {layerGroups[gid]?.name}
              </button>
            ))}
          </>
        )}
        {currentGroupId && (
          <>
            <div className="h-px bg-border my-1" />
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors"
              onClick={() => { removeLayerFromGroup(currentGroupId, key); onClose() }}
            >
              <X size={12} /> Remove from group
            </button>
          </>
        )}
        <div className="h-px bg-border my-1" />
        <button
          className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-destructive transition-colors"
          onClick={handleRemove}
        >
          <Trash2 size={12} /> Remove layer
        </button>
      </div>
    </>
  )
}
