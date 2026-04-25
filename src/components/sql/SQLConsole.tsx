/**
 * SQLConsole — Issue #140 (Sprint R-5)
 *
 * Onglet SQL dans le bottom panel :
 *   - Editeur SQL avec syntax highlighting basique (SQLEditor existant)
 *   - Ctrl+Enter pour executer
 *   - Resultats pagines dans un tableau
 *   - Export (GeoJSON / CSV / GPKG)
 *   - "Add to map" pour les resultats avec geometrie
 *   - Historique des requetes dans localStorage
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  PlayIcon,
  DownloadIcon,
  HistoryIcon,
  MapIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { toast } from "sonner"
import { SQLEditor } from "./SQLEditor"
import { SQLPreviewTable } from "./SQLPreviewTable"
import { sqlExecute, sqlExport } from "@/api/client"

// ---------------------------------------------------------------------------
// History persistence
// ---------------------------------------------------------------------------

const HISTORY_KEY = "gispulse:sql_console_history"
const MAX_HISTORY = 50

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(history: string[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100

export function SQLConsole() {
  const [sql, setSql] = useState("SELECT 1 AS ping")
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{
    columns: string[]
    rows: Record<string, unknown>[]
    total: number
    error?: string
  } | null>(null)
  const [page, setPage] = useState(0)
  const [history, setHistory] = useState<string[]>(() => loadHistory())
  const [showHistory, setShowHistory] = useState(false)
  const [exporting, setExporting] = useState(false)

  const runQuery = useCallback(async (querySql?: string) => {
    const q = (querySql ?? sql).trim()
    if (!q) return
    setRunning(true)
    setPage(0)
    try {
      const res = await sqlExecute({ sql: q, limit: PAGE_SIZE, offset: 0 })
      setResult(res)
      if (!res.error) {
        // Add to history (deduplicated, newest first)
        setHistory((prev) => {
          const next = [q, ...prev.filter((h) => h !== q)]
          saveHistory(next)
          return next
        })
      }
    } catch (err) {
      setResult({
        columns: [],
        rows: [],
        total: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setRunning(false)
    }
  }, [sql])

  const runPage = useCallback(async (newPage: number) => {
    const q = sql.trim()
    if (!q || !result) return
    setRunning(true)
    try {
      const res = await sqlExecute({ sql: q, limit: PAGE_SIZE, offset: newPage * PAGE_SIZE })
      setResult(res)
      setPage(newPage)
    } catch (err) {
      toast.error("Pagination failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setRunning(false)
    }
  }, [sql, result])

  const handleExport = useCallback(async (fmt: "geojson" | "csv" | "gpkg") => {
    const q = sql.trim()
    if (!q) return
    setExporting(true)
    try {
      await sqlExport({ sql: q, format: fmt, filename: "sql_export" })
      toast.success(`Exported as ${fmt.toUpperCase()}`)
    } catch (err) {
      toast.error("Export failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setExporting(false)
    }
  }, [sql])

  // Ctrl+Enter shortcut inside the console container
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        runQuery()
      }
    }
    el.addEventListener("keydown", handler)
    return () => el.removeEventListener("keydown", handler)
  }, [runQuery])

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1
  const hasGeom = result?.columns.some((c) =>
    ["geom", "geometry", "the_geom", "wkb_geometry"].includes(c.toLowerCase()),
  )

  return (
    <div ref={containerRef} className="flex h-full flex-col overflow-hidden">
      {/* Editor zone */}
      <div className="border-b p-2 flex-shrink-0">
        <SQLEditor
          value={sql}
          onChange={setSql}
          minRows={4}
          compact
        />

        {/* Toolbar */}
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => runQuery()}
            disabled={running || !sql.trim()}
            className="flex items-center gap-1.5 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            title="Run query (Ctrl+Enter)"
          >
            <PlayIcon className="h-3.5 w-3.5" />
            {running ? "Running…" : "Run"}
          </button>

          <button
            onClick={() => setShowHistory((s) => !s)}
            className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs hover:bg-accent transition-colors"
            title="Query history"
          >
            <HistoryIcon className="h-3.5 w-3.5" />
            History ({history.length})
          </button>

          {result && !result.error && (
            <>
              <div className="flex items-center gap-0.5 rounded border overflow-hidden text-xs">
                {(["csv", "geojson", "gpkg"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    disabled={exporting}
                    className="flex items-center gap-1 px-2 py-1 hover:bg-accent transition-colors disabled:opacity-50"
                    title={`Export as ${fmt.toUpperCase()}`}
                  >
                    <DownloadIcon className="h-3 w-3" />
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>

              {hasGeom && (
                <button
                  className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent transition-colors"
                  title="Add results as a layer on the map (coming soon)"
                  onClick={() => toast.info("Add to map: import the exported GeoJSON via drag-and-drop")}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  Add to map
                </button>
              )}
            </>
          )}

          <span className="ml-auto text-label text-muted-foreground">Ctrl+Enter to run</span>
        </div>
      </div>

      {/* History dropdown */}
      {showHistory && history.length > 0 && (
        <div className="border-b bg-muted/30 max-h-36 overflow-auto flex-shrink-0">
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => {
                setSql(h)
                setShowHistory(false)
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent group"
            >
              <span className="truncate font-mono text-foreground">{h}</span>
              <XIcon
                className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  setHistory((prev) => {
                    const next = prev.filter((_, idx) => idx !== i)
                    saveHistory(next)
                    return next
                  })
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Results area */}
      <div className="flex-1 overflow-auto">
        {result === null && (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Run a query to see results
          </div>
        )}

        {result?.error && (
          <div className="m-3 rounded border border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-400 font-mono whitespace-pre-wrap">
            {result.error}
          </div>
        )}

        {result && !result.error && result.columns.length > 0 && (
          <SQLPreviewTable columns={result.columns} rows={result.rows} />
        )}

        {result && !result.error && result.columns.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Query returned no columns
          </div>
        )}
      </div>

      {/* Pagination */}
      {result && !result.error && result.total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t px-3 py-1.5">
          <span className="text-label text-muted-foreground">
            {result.total.toLocaleString()} rows total · page {page + 1}/{totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => runPage(page - 1)}
              disabled={page === 0 || running}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              Prev
            </button>
            <button
              onClick={() => runPage(page + 1)}
              disabled={page >= totalPages - 1 || running}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-40"
            >
              Next
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
