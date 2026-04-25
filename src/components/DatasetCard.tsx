/**
 * DatasetCard — Sprint R-3, issue #128
 *
 * Rich card component for displaying dataset metadata with layer preview,
 * format badge, CRS, feature counts, and quick-action buttons.
 */

import { useState } from "react"
import {
  HardDrive,
  Layers,
  ChevronDown,
  ChevronRight,
  Trash2,
  Pencil,
  Download,
  MapPin,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { DatasetMeta, LayerMeta } from "@/types/dataset"

// ---------------------------------------------------------------------------
// Shared helpers (extracted to lib/geo-display.ts — audit M27)
// ---------------------------------------------------------------------------

import { formatBytes, formatNumber, formatBadgeClass } from "@/lib/geo-display"
import { GeomIcon } from "@/components/layers/GeomIcon"

// ---------------------------------------------------------------------------
// LayerPreviewRow
// ---------------------------------------------------------------------------

function LayerPreviewRow({ layer }: { layer: LayerMeta }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5 text-label-lg text-muted-foreground">
      <GeomIcon type={layer.geometry_type} />
      <span className="truncate flex-1 font-mono text-label">{layer.name}</span>
      <span className="tabular-nums text-label shrink-0">
        {formatNumber(layer.feature_count)} feat.
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DatasetCard
// ---------------------------------------------------------------------------

export interface DatasetCardProps {
  dataset: DatasetMeta
  /** Show full layer list expanded by default */
  defaultExpanded?: boolean
  /** Callback when user clicks "Open on map" */
  onOpenMap?: (dataset: DatasetMeta) => void
  /** Callback when user clicks "Delete" */
  onDelete?: (dataset: DatasetMeta) => void
  /** Callback when user clicks "Rename" */
  onRename?: (dataset: DatasetMeta) => void
  /** Callback when user clicks "Export" */
  onExport?: (dataset: DatasetMeta) => void
  /** Whether the card is in a selected/highlighted state */
  selected?: boolean
  /** Click on the card body */
  onClick?: (dataset: DatasetMeta) => void
  /** Right-click context menu handler */
  onContextMenu?: (e: React.MouseEvent, dataset: DatasetMeta) => void
}

export function DatasetCard({
  dataset,
  defaultExpanded = false,
  onOpenMap,
  onDelete,
  onRename,
  onExport,
  selected = false,
  onClick,
  onContextMenu,
}: DatasetCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const layers = dataset.layers ?? []
  const totalFeatures = layers.reduce((acc, l) => acc + l.feature_count, 0)
  const created = new Date(dataset.created_at).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

  const handleCardClick = () => {
    onClick?.(dataset)
  }

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded((v) => !v)
  }

  return (
    <div
      className={`group rounded-lg border bg-background transition-all hover:shadow-md ${
        selected
          ? "border-primary/70 ring-1 ring-primary/30 shadow-sm"
          : "hover:border-primary/30"
      } ${onClick ? "cursor-pointer" : ""}`}
      onClick={handleCardClick}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e, dataset) } : undefined}
    >
      {/* Header */}
      <div className="flex items-start gap-2 p-3">
        {/* Icon */}
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <HardDrive size={15} className="text-muted-foreground" />
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="truncate text-sm font-medium leading-tight">{dataset.name}</span>
            <Badge className={`text-label-sm px-1.5 h-4 ${formatBadgeClass(dataset.format)}`}>
              {dataset.format.toUpperCase()}
            </Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-label text-muted-foreground">
            <span>{layers.length} layer{layers.length !== 1 ? "s" : ""}</span>
            {totalFeatures > 0 && <span>{formatNumber(totalFeatures)} features</span>}
            {dataset.file_size > 0 && <span>{formatBytes(dataset.file_size)}</span>}
            <span>{created}</span>
          </div>
        </div>

        {/* Action buttons (visible on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          {onOpenMap && (
            <ActionButton
              icon={<MapPin size={12} />}
              label="Open on map"
              onClick={() => onOpenMap(dataset)}
            />
          )}
          {onRename && (
            <ActionButton
              icon={<Pencil size={12} />}
              label="Rename"
              onClick={() => onRename(dataset)}
            />
          )}
          {onExport && (
            <ActionButton
              icon={<Download size={12} />}
              label="Export"
              onClick={() => onExport(dataset)}
            />
          )}
          {onDelete && (
            <ActionButton
              icon={<Trash2 size={12} />}
              label="Delete"
              onClick={() => onDelete(dataset)}
              danger
            />
          )}
        </div>
      </div>

      {/* CRS badge */}
      {dataset.crs && dataset.crs !== "unknown" && (
        <div className="px-3 pb-1">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-label-sm text-muted-foreground">
            {dataset.crs}
          </span>
        </div>
      )}

      {/* Layer preview section */}
      {layers.length > 0 && (
        <div className="border-t px-3 pb-2">
          <button
            className="flex w-full items-center gap-1 py-1.5 text-label font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleExpandToggle}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <Layers size={11} />
            <span>Layers</span>
            <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-label-sm">
              {layers.length}
            </Badge>
          </button>

          {expanded && (
            <div className="mt-0.5 space-y-0 divide-y divide-border/50 rounded-md border bg-muted/20 px-2 py-1">
              {layers.map((layer) => (
                <LayerPreviewRow key={layer.name} layer={layer} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActionButton helper
// ---------------------------------------------------------------------------

function ActionButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
        danger
          ? "text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground/60 hover:bg-accent hover:text-foreground"
      }`}
    >
      {icon}
    </button>
  )
}
