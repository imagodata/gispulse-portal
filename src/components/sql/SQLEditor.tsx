/**
 * SQLEditor — enriched textarea SQL editor for the GISPulse portal.
 *
 * Features:
 * - Monospace font, simulated line numbers, dark background
 * - CSS resize: vertical
 * - Placeholder detection: {param} patterns generate dynamic inputs
 * - Preview button (LIMIT 10) calling the backend preview endpoint
 * - Results in a scrollable SQLPreviewTable
 * - SQL errors displayed in red
 *
 * No external dependencies (no Monaco, no CodeMirror).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { SQLPreviewTable } from "./SQLPreviewTable"
import { previewSQL } from "@/api/client"

// ---------------------------------------------------------------------------
// Placeholder extraction
// ---------------------------------------------------------------------------

const PLACEHOLDER_RE = /\{(\w+)\}/g

function extractPlaceholders(sql: string): string[] {
  const found = new Set<string>()
  let match: RegExpExecArray | null
  PLACEHOLDER_RE.lastIndex = 0
  while ((match = PLACEHOLDER_RE.exec(sql)) !== null) {
    found.add(match[1])
  }
  return Array.from(found)
}

// ---------------------------------------------------------------------------
// Simple SQL formatter (indent after keywords)
// ---------------------------------------------------------------------------

function formatSQL(sql: string): string {
  const keywords = [
    "SELECT",
    "FROM",
    "WHERE",
    "GROUP BY",
    "ORDER BY",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "JOIN",
    "LEFT JOIN",
    "RIGHT JOIN",
    "INNER JOIN",
    "CROSS JOIN",
    "ON",
    "AND",
    "OR",
    "UNION",
    "UNION ALL",
    "INSERT INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE FROM",
    "CREATE TABLE",
    "ALTER TABLE",
    "DROP TABLE",
    "WITH",
  ]
  // Collapse whitespace
  let result = sql.replace(/\s+/g, " ").trim()
  // Add newline before major keywords
  for (const kw of keywords) {
    const re = new RegExp(`\\b(${kw})\\b`, "gi")
    result = result.replace(re, "\n$1")
  }
  return result.trim()
}

// ---------------------------------------------------------------------------
// Line numbers component
// ---------------------------------------------------------------------------

function LineNumbers({ count }: { count: number }) {
  return (
    <div
      className="select-none text-right pr-2 text-label leading-[1.35rem] text-slate-500 dark:text-slate-600 font-mono"
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i + 1}>{i + 1}</div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface SQLEditorProps {
  /** Current SQL value (controlled). */
  value: string
  /** Called when the SQL text changes. */
  onChange: (sql: string) => void
  /** Optional DSN for preview queries (passed to backend). */
  dsn?: string
  /** Minimum rows for the textarea. */
  minRows?: number
  /** If true, render inside a node (compact mode). */
  compact?: boolean
}

interface PreviewState {
  loading: boolean
  columns: string[]
  rows: Record<string, unknown>[]
  error: string | null
}

export function SQLEditor({
  value,
  onChange,
  dsn = "",
  minRows = 6,
  compact = false,
}: SQLEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineCountRef = useRef<HTMLDivElement>(null)

  // ------ Placeholder params ------
  const placeholders = useMemo(() => extractPlaceholders(value), [value])
  const [params, setParams] = useState<Record<string, string>>({})

  // Sync param keys when placeholders change
  useEffect(() => {
    setParams((prev) => {
      const next: Record<string, string> = {}
      for (const p of placeholders) {
        next[p] = prev[p] ?? ""
      }
      return next
    })
  }, [placeholders])

  const updateParam = useCallback((key: string, val: string) => {
    setParams((prev) => ({ ...prev, [key]: val }))
  }, [])

  // ------ Line count ------
  const lineCount = useMemo(() => {
    const count = value.split("\n").length
    return Math.max(count, minRows)
  }, [value, minRows])

  // ------ Sync scroll between line numbers and textarea ------
  const onScroll = useCallback(() => {
    if (textareaRef.current && lineCountRef.current) {
      lineCountRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  // ------ Format button ------
  const onFormat = useCallback(() => {
    onChange(formatSQL(value))
  }, [value, onChange])

  // ------ Preview ------
  const [preview, setPreview] = useState<PreviewState>({
    loading: false,
    columns: [],
    rows: [],
    error: null,
  })

  const onPreview = useCallback(async () => {
    setPreview({ loading: true, columns: [], rows: [], error: null })
    try {
      const result = await previewSQL(value, params, 10, dsn || undefined)
      if (result.error) {
        setPreview({
          loading: false,
          columns: [],
          rows: [],
          error: result.error,
        })
      } else {
        setPreview({
          loading: false,
          columns: result.columns,
          rows: result.rows,
          error: null,
        })
      }
    } catch (err) {
      setPreview({
        loading: false,
        columns: [],
        rows: [],
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [value, params, dsn])

  // ------ Tab key support (insert 2 spaces) ------
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault()
        const ta = e.currentTarget
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const newValue = value.substring(0, start) + "  " + value.substring(end)
        onChange(newValue)
        // Restore cursor after React re-render
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2
        })
      }
    },
    [value, onChange],
  )

  return (
    <div className={compact ? "" : "space-y-2"}>
      {/* Editor area */}
      <div className="rounded border border-slate-300 dark:border-slate-600 bg-slate-900 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 border-b border-slate-700">
          <span className="text-label font-semibold text-slate-400 uppercase tracking-wider mr-auto">
            SQL
          </span>
          <button
            type="button"
            onClick={onFormat}
            className="px-2 py-0.5 text-label font-medium rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Format
          </button>
          <button
            type="button"
            onClick={onPreview}
            disabled={preview.loading || !value.trim()}
            className="px-2 py-0.5 text-label font-medium rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {preview.loading ? "Running..." : "Preview (LIMIT 10)"}
          </button>
        </div>

        {/* Editor body: line numbers + textarea */}
        <div className="flex" style={{ minHeight: `${minRows * 1.35}rem` }}>
          <div
            ref={lineCountRef}
            className="overflow-hidden py-1.5 bg-slate-800/60 border-r border-slate-700 min-w-[2.5rem]"
          >
            <LineNumbers count={lineCount} />
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={onScroll}
            onKeyDown={onKeyDown}
            spellCheck={false}
            placeholder="SELECT * FROM {input_table}\nWHERE ST_Intersects(geom, ST_MakeEnvelope(...))"
            rows={minRows}
            className="nodrag nowheel flex-1 bg-transparent text-slate-100 text-xs font-mono leading-[1.35rem] px-2 py-1.5 resize-y outline-none placeholder:text-slate-600 min-h-0"
            style={{ tabSize: 2 }}
          />
        </div>
      </div>

      {/* Dynamic placeholder inputs */}
      {placeholders.length > 0 && (
        <div className="space-y-1">
          <div className="text-label font-semibold text-muted-foreground uppercase tracking-wider">
            Parameters
          </div>
          <div className={compact ? "space-y-1" : "grid grid-cols-2 gap-2"}>
            {placeholders.map((p) => (
              <div key={p} className="flex items-center gap-2">
                <label htmlFor={`sql-param-${p}`} className="text-xs font-mono text-muted-foreground min-w-[80px]">
                  {"{" + p + "}"}
                </label>
                <input
                  id={`sql-param-${p}`}
                  type="text"
                  value={params[p] ?? ""}
                  onChange={(e) => updateParam(p, e.target.value)}
                  placeholder={p}
                  className="nodrag nowheel flex-1 rounded border border-slate-300 dark:border-slate-600 bg-background px-2 py-0.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error display */}
      {preview.error && (
        <div className="rounded border border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/50 px-3 py-2 text-xs text-red-700 dark:text-red-400 font-mono whitespace-pre-wrap">
          {preview.error}
        </div>
      )}

      {/* Results table */}
      {!preview.error && preview.columns.length > 0 && (
        <div>
          <div className="text-label font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Preview ({preview.rows.length} row{preview.rows.length !== 1 ? "s" : ""})
          </div>
          <SQLPreviewTable columns={preview.columns} rows={preview.rows} />
        </div>
      )}
    </div>
  )
}
