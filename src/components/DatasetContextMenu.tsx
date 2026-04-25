/**
 * DatasetContextMenu — Shared right-click context menu for datasets.
 *
 * Used by ExplorerWorkspace, DatasetsWorkspace, and LeftPanel.
 * Pure presentation: all actions are callbacks from the parent.
 */

import { MapPin, Pencil, Download, Trash2 } from "lucide-react"

const btnCls = "flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors"

interface DatasetContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onRename: () => void
  onExport: () => void
  onDelete: () => void
  /** Optional — only shown in Explorer (navigate to map). */
  onOpenMap?: () => void
}

export function DatasetContextMenu({
  x,
  y,
  onClose,
  onRename,
  onExport,
  onDelete,
  onOpenMap,
}: DatasetContextMenuProps) {
  // Clamp to viewport to prevent off-screen rendering
  const menuWidth = 180
  const menuHeight = onOpenMap ? 160 : 130
  const left = Math.min(x, window.innerWidth - menuWidth - 8)
  const top = Math.min(y, window.innerHeight - menuHeight - 8)

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-[180px] rounded-md border bg-popover py-1 shadow-md text-xs"
        style={{ left, top }}
      >
        {onOpenMap && (
          <button
            className={btnCls}
            onClick={() => { onOpenMap(); onClose() }}
          >
            <MapPin size={12} /> Open on map
          </button>
        )}
        <button
          className={btnCls}
          onClick={() => { onRename(); onClose() }}
        >
          <Pencil size={12} /> Rename
        </button>
        <button
          className={btnCls}
          onClick={() => { onExport(); onClose() }}
        >
          <Download size={12} /> Export as GPKG
        </button>
        <div className="h-px bg-border my-1" />
        <button
          className={`${btnCls} text-destructive`}
          onClick={() => { onDelete(); onClose() }}
        >
          <Trash2 size={12} /> Delete dataset
        </button>
      </div>
    </>
  )
}
