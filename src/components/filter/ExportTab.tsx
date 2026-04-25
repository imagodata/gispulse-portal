/**
 * ExportTab — Export filtered results.
 *
 * Format selection, projection, style inclusion, download.
 */

import { useCallback, useState } from "react"
import { useFilterStore } from "@/stores/filterStore"
import { useDatasetStore } from "@/stores/datasetStore"
import { exportGpkg, exportLayers } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { DownloadIcon, Loader2Icon, FileIcon } from "lucide-react"

const FORMATS = [
  { id: "gpkg", label: "GeoPackage (.gpkg)", ext: "gpkg" },
  { id: "geojson", label: "GeoJSON (.geojson)", ext: "geojson" },
  { id: "shp", label: "Shapefile (.shp)", ext: "shp" },
  { id: "parquet", label: "GeoParquet (.parquet)", ext: "parquet" },
  { id: "fgb", label: "FlatGeobuf (.fgb)", ext: "fgb" },
]

export function ExportTab() {
  const targetDatasetId = useFilterStore((s) => s.targetDatasetId)
  const targetLayerName = useFilterStore((s) => s.targetLayerName)
  const filteredCount = useFilterStore((s) => s.filteredCount)
  const expression = useFilterStore((s) => s.expression)
  const datasets = useDatasetStore((s) => s.datasets)

  const [format, setFormat] = useState("gpkg")
  const [targetCrs, setTargetCrs] = useState("EPSG:4326")
  const [includeStyles, setIncludeStyles] = useState(true)
  const [exporting, setExporting] = useState(false)

  const currentDataset = datasets.find((d) => d.id === targetDatasetId)

  const handleExport = useCallback(async () => {
    if (!targetDatasetId || !targetLayerName) {
      toast.error("Select a layer to export")
      return
    }

    setExporting(true)
    try {
      if (format === "gpkg") {
        await exportGpkg([{ datasetId: targetDatasetId, layerName: targetLayerName }])
        toast.success("GPKG export started")
      } else {
        await exportLayers([{ datasetId: targetDatasetId, layerName: targetLayerName }], format)
        toast.success(`${format.toUpperCase()} export started`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }, [targetDatasetId, targetLayerName, format])

  return (
    <div className="space-y-4">
      {/* Current filter context */}
      <div className="rounded-md border bg-muted/50 p-3 space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <FileIcon className="size-3.5 text-muted-foreground" />
          <span className="font-medium">
            {currentDataset?.name ?? "No dataset selected"}
          </span>
        </div>
        {targetLayerName && (
          <div className="text-xs text-muted-foreground">
            Layer: {targetLayerName}
          </div>
        )}
        {filteredCount !== null && (
          <Badge variant="secondary" className="text-label">
            {filteredCount} filtered features
          </Badge>
        )}
        {expression && (
          <div className="font-mono text-label text-muted-foreground truncate">
            expr: {expression}
          </div>
        )}
      </div>

      {/* Format */}
      <div className="space-y-1">
        <label htmlFor="export-format" className="text-xs font-medium text-muted-foreground">Format</label>
        <select
          id="export-format"
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          {FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Target CRS */}
      <div className="space-y-1">
        <label htmlFor="export-projection" className="text-xs font-medium text-muted-foreground">Projection</label>
        <Input
          id="export-projection"
          placeholder="EPSG:4326"
          value={targetCrs}
          onChange={(e) => setTargetCrs(e.target.value)}
          className="font-mono text-xs"
        />
      </div>

      {/* Include styles (GPKG only) */}
      {format === "gpkg" && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="include-styles"
            checked={includeStyles}
            onChange={(e) => setIncludeStyles(e.target.checked)}
            className="size-3.5"
          />
          <label htmlFor="include-styles" className="text-xs font-medium text-muted-foreground">
            Include layer styles
          </label>
        </div>
      )}

      {/* Export button */}
      <Button
        className="w-full"
        onClick={handleExport}
        disabled={!targetDatasetId || !targetLayerName || exporting}
      >
        {exporting ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <DownloadIcon className="size-4" />
        )}
        Export {filteredCount !== null ? `${filteredCount} features` : "layer"}
      </Button>

      {!targetDatasetId && (
        <p className="text-center text-xs text-muted-foreground">
          Select a layer in the Filter or Explore tab first
        </p>
      )}
    </div>
  )
}
