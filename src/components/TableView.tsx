import { useCallback, useEffect, useMemo, useState } from "react"
import { useDatasetStore, useSelectedLayer } from "@/stores/datasetStore"
import { getFeatures } from "@/api/client"
import type { FeatureCollection } from "@/api/client"

const PAGE_SIZE = 100

type SortDir = "asc" | "desc"

interface FeatureRow {
  _fid: number | string
  _geom: string
  [key: string]: unknown
}

/** Truncate WKT/GeoJSON geometry to a readable summary. */
function summarizeGeometry(geom: unknown): string {
  if (!geom || typeof geom !== "object") return ""
  const g = geom as Record<string, unknown>
  const type = String(g.type ?? "")
  const coords = g.coordinates
  if (!coords) return type || ""
  // Show type + first coordinate pair for compact display
  if (Array.isArray(coords)) {
    if (type.toUpperCase() === "POINT" && coords.length >= 2) {
      return `POINT(${Number(coords[0]).toFixed(4)}, ${Number(coords[1]).toFixed(4)})`
    }
    const depth = Array.isArray(coords[0]) ? (Array.isArray((coords[0] as unknown[])[0]) ? "..." : `${coords.length} pts`) : ""
    return `${type}(${depth})`
  }
  return type
}

/** Convert a GeoJSON FeatureCollection to table rows. */
function featuresToRows(fc: FeatureCollection): FeatureRow[] {
  return fc.features.map((f, idx) => {
    const feat = f as {
      id?: number | string
      properties?: Record<string, unknown>
      geometry?: unknown
    }
    const props = feat.properties ?? {}
    const fid = feat.id ?? props.fid ?? idx + 1
    const row: FeatureRow = {
      _fid: fid as number | string,
      _geom: summarizeGeometry(feat.geometry),
    }
    for (const [k, v] of Object.entries(props)) {
      if (k === "fid") continue
      row[k] = v
    }
    return row
  })
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b)
  return String(a ?? "").localeCompare(String(b ?? ""))
}

export function TableView({ compact = false }: { compact?: boolean }) {
  const layer = useSelectedLayer()
  const selectedDatasetId = useDatasetStore((s) => s.selectedDatasetId)

  const [rows, setRows] = useState<FeatureRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [selectedRow, setSelectedRow] = useState<number | string | null>(null)

  // Reset state when layer changes
  useEffect(() => {
    setRows([])
    setTotalCount(0)
    setPage(0)
    setSortCol(null)
    setError(null)
    setSelectedRow(null)
  }, [selectedDatasetId, layer?.name])

  // Fetch features when layer or page changes
  const fetchPage = useCallback(async () => {
    if (!selectedDatasetId || !layer) return
    setLoading(true)
    setError(null)
    try {
      const fc = await getFeatures(selectedDatasetId, layer.name, {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      setRows(featuresToRows(fc))
      setTotalCount(fc.total_count ?? fc.features.length)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load features"
      setError(msg)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [selectedDatasetId, layer, page])

  useEffect(() => {
    fetchPage()
  }, [fetchPage])

  // Client-side sort on current page
  const sortedRows = useMemo(() => {
    if (!sortCol) return rows
    return [...rows].sort((a, b) => {
      const va = a[sortCol]
      const vb = b[sortCol]
      if (va === undefined || vb === undefined) return 0
      const cmp = compareValues(va, vb)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [rows, sortCol, sortDir])

  if (!layer) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a layer to view attributes
      </div>
    )
  }

  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === "asc") {
        setSortDir("desc")
      } else {
        // Third click: clear sort
        setSortCol(null)
      }
    } else {
      setSortCol(col)
      setSortDir("asc")
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rangeStart = page * PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, totalCount)

  const allColumns = ["_fid", "_geom", ...layer.fields.map((f) => f.name)]

  return (
    <div className="flex h-full flex-col">
      {/* Header info — hidden in compact mode (BottomPanel) */}
      {!compact && (
        <div className="flex-none border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{layer.name}</span>
            <span className="text-label text-muted-foreground">
              {layer.feature_count} features | {layer.geometry_type ?? "no geometry"} | {layer.crs}
            </span>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex-none border-b bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5">
          <span className="text-label-lg text-blue-600 dark:text-blue-400">
            Loading features...
          </span>
        </div>
      )}

      {/* Error display */}
      {error && !loading && (
        <div className="flex-none border-b bg-red-50 dark:bg-red-950/30 px-3 py-1.5">
          <span className="text-label-lg text-red-600 dark:text-red-400">
            {error}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="border-b">
              {allColumns.map((col) => {
                const field = layer.fields.find((f) => f.name === col)
                const isSorted = sortCol === col
                return (
                  <th
                    key={col}
                    scope="col"
                    aria-sort={isSorted ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                    className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort(col)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort(col) } }}
                    tabIndex={0}
                    role="columnheader"
                  >
                    <div className="flex items-center gap-1">
                      <span>{col}</span>
                      {isSorted && (
                        <span className="text-label">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                      )}
                    </div>
                    {field && (
                      <div className="text-label font-normal opacity-60">{field.type}</div>
                    )}
                    {col === "_fid" && (
                      <div className="text-label font-normal opacity-60">id</div>
                    )}
                    {col === "_geom" && (
                      <div className="text-label font-normal opacity-60">geometry</div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {!loading && sortedRows.length === 0 && !error && (
              <tr>
                <td colSpan={allColumns.length} className="px-3 py-8 text-center text-muted-foreground">
                  No features to display
                </td>
              </tr>
            )}
            {sortedRows.map((row, idx) => (
              <tr
                key={String(row._fid)}
                className={[
                  "border-b border-border/50 transition-colors cursor-pointer",
                  selectedRow === row._fid
                    ? "bg-primary/10"
                    : idx % 2 === 0
                      ? "bg-background"
                      : "bg-muted/30",
                  "hover:bg-accent/50",
                ].join(" ")}
                onClick={() => setSelectedRow(selectedRow === row._fid ? null : row._fid)}
              >
                {allColumns.map((col) => {
                  const val = row[col]
                  return (
                    <td key={col} className="whitespace-nowrap px-3 py-1.5 font-mono">
                      {col === "_geom" ? (
                        <span className="text-muted-foreground" title={String(val)}>
                          {String(val)}
                        </span>
                      ) : typeof val === "boolean" ? (
                        <span className={val ? "text-green-600" : "text-red-500"}>
                          {String(val)}
                        </span>
                      ) : val === null || val === undefined ? (
                        <span className="text-muted-foreground/50 italic">NULL</span>
                      ) : (
                        String(val)
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with pagination — rows indicator + Prev/Next (#208) */}
      <div
        className="flex-none border-t bg-muted/50 px-3 py-1.5 flex items-center justify-between"
        role="navigation"
        aria-label="Table pagination"
      >
        <span className="text-label-lg text-muted-foreground tabular-nums">
          {totalCount > 0 ? (
            <>
              Rows {rangeStart}–{rangeEnd} of {totalCount.toLocaleString()}
              {totalPages > 1 && (
                <span className="ml-1 text-muted-foreground/60">
                  (page {page + 1}/{totalPages})
                </span>
              )}
            </>
          ) : (
            "No features"
          )}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              className="rounded px-2 py-0.5 text-label-lg bg-muted hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <button
              type="button"
              aria-label="Next page"
              className="rounded px-2 py-0.5 text-label-lg bg-muted hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
