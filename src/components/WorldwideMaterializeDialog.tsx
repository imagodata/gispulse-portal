/**
 * WorldwideMaterializeDialog — modal to materialize a virtual worldwide
 * dataset into a real on-disk dataset.
 * Issue #238 (A12) — EPIC v1.9.0 #226 (global geo-data aggregator).
 *
 * The user draws a bounding box; the "Materialize" button stays disabled
 * until a bbox is set (acceptance criterion). An optional "Preview" call
 * scans the remote source and reports a feature count before download.
 */

import { useCallback, useState } from "react"
import "maplibre-gl/dist/maplibre-gl.css"
import { Box, X, Loader2, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BBoxDrawMap } from "@/components/CatalogImportDialog"
import { useT } from "@/i18n/useT"
import {
  previewVirtualDataset,
  materializeVirtualDataset,
  type CatalogImportResult,
} from "@/api/catalog"
import type { WorldwideEntry } from "@/types/catalog"
import type { DatasetMeta } from "@/types/dataset"

type BBox = [number, number, number, number]

export interface WorldwideMaterializeDialogProps {
  entry: WorldwideEntry
  /** The virtual dataset created from `entry`. */
  virtual: DatasetMeta
  onClose: () => void
  /** Called when the preview returns updated stats (feature_count, bbox). */
  onPreviewed: (ds: DatasetMeta) => void
  /** Called when materialization succeeds with the real dataset. */
  onMaterialized: (result: CatalogImportResult) => void
}

export function WorldwideMaterializeDialog({
  entry,
  virtual,
  onClose,
  onPreviewed,
  onMaterialized,
}: WorldwideMaterializeDialogProps) {
  const t = useT()
  const [bbox, setBBox] = useState<BBox | null>(null)
  const [name, setName] = useState(entry.name)
  const [previewing, setPreviewing] = useState(false)
  const [materializing, setMaterializing] = useState(false)
  const [featureCount, setFeatureCount] = useState<number | null>(
    virtual.feature_count ?? null,
  )
  const [error, setError] = useState<string | null>(null)

  // No reset effect: the parent passes a `key` keyed on the entry id, so a
  // new entry remounts the dialog fresh (avoids setState-in-effect).

  const handlePreview = useCallback(async () => {
    setPreviewing(true)
    setError(null)
    try {
      const ds = await previewVirtualDataset(virtual.id, bbox)
      setFeatureCount(ds.feature_count ?? null)
      onPreviewed(ds)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPreviewing(false)
    }
  }, [virtual.id, bbox, onPreviewed])

  const handleMaterialize = useCallback(async () => {
    if (!bbox) return
    setMaterializing(true)
    setError(null)
    try {
      const result = await materializeVirtualDataset(
        virtual.id,
        name.trim() || entry.name,
        bbox,
      )
      onMaterialized(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setMaterializing(false)
    }
  }, [virtual.id, name, entry.name, bbox, onMaterialized])

  const busy = previewing || materializing

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Materialize ${entry.name}`}
        className="relative z-10 w-full max-w-lg rounded-lg border bg-background shadow-xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3 border-b">
          <Box size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">
              {t("worldwide.action.materialize")}: {entry.name}
            </h2>
            <p className="text-label text-muted-foreground truncate">
              {entry.jurisdiction} / {entry.domain} / {entry.family}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("common.close")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              {t("worldwide.action.preview")}
            </label>
            <BBoxDrawMap bbox={bbox} onBBoxChange={setBBox} />
            {bbox ? (
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-label-sm font-mono text-muted-foreground">
                  {bbox.map((v) => v.toFixed(4)).join(", ")}
                </span>
                <button
                  onClick={() => setBBox(null)}
                  className="text-label text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("common.delete")}
                </button>
              </div>
            ) : (
              <p className="text-label text-amber-600 dark:text-amber-400 mt-1">
                {t("worldwide.hint.need_bbox")}
              </p>
            )}
          </div>

          {/* Name */}
          <div>
            <label
              htmlFor="materialize-name"
              className="text-xs font-medium text-foreground mb-1 block"
            >
              {t("worldwide.action.materialize")}
            </label>
            <input
              id="materialize-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={entry.name}
              className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Feature count after preview */}
          {featureCount != null && (
            <Badge variant="secondary" className="text-label">
              {featureCount.toLocaleString()} {t("worldwide.feature_count")}
            </Badge>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/30">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={busy}
            className="gap-1.5"
          >
            {previewing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Eye size={14} />
            )}
            {t("worldwide.action.preview")}
          </Button>
          <Button
            size="sm"
            onClick={handleMaterialize}
            disabled={busy || !bbox}
            data-testid="worldwide-materialize-btn"
            className="gap-1.5"
          >
            {materializing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t("worldwide.action.materializing")}
              </>
            ) : (
              <>
                <Box size={14} />
                {t("worldwide.action.materialize")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
