/**
 * SQLPreviewPanel — Displays the SQL generated from the current node graph.
 * Shows trigger_operations INSERT statements, composite rules, custom expressions.
 * Updates in real-time as the graph changes.
 *
 * Issue #162
 */

import { useMemo, useState } from "react"
import { useReactFlow } from "@xyflow/react"
import { Copy, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { serializeTriggerOperations } from "@/lib/triggerOperationSerializer"

export function SQLPreviewPanel() {
  const { getNodes, getEdges } = useReactFlow()
  const [refreshKey, setRefreshKey] = useState(0)

  // Re-serialize on refresh or when panel mounts
  const result = useMemo(() => {
    void refreshKey // dependency trigger
    return serializeTriggerOperations(getNodes(), getEdges())
  }, [refreshKey, getNodes, getEdges])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.sql)
      toast.success("SQL copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }

  const opCount = result.operations.length
  const beforeCount = result.operations.filter((o) => o.phase === "before").length
  const afterCount = result.operations.filter((o) => o.phase === "after").length

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0">
        <span className="text-xs font-semibold text-foreground">SQL Preview</span>
        <span className="text-label text-muted-foreground">
          {opCount} ops ({beforeCount} BEFORE, {afterCount} AFTER)
        </span>

        {result.errors.length > 0 && (
          <div className="flex items-center gap-1 text-label text-red-500">
            <AlertTriangle className="h-3 w-3" />
            {result.errors.length} error(s)
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Copy SQL"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950/30 border-b space-y-0.5">
          {result.errors.map((err, idx) => (
            <div key={idx} className="flex items-start gap-1 text-label text-red-600 dark:text-red-400">
              <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* SQL content */}
      <div className="flex-1 overflow-auto p-3">
        {result.sql ? (
          <pre className="text-label-lg font-mono leading-relaxed text-foreground whitespace-pre-wrap">
            {result.sql.split("\n").map((line, idx) => {
              // Color BEFORE/AFTER comments
              const isBefore = line.includes("BEFORE")
              const isAfter = line.includes("AFTER")
              const isComment = line.trimStart().startsWith("--")
              return (
                <div
                  key={idx}
                  className={
                    isComment
                      ? isBefore
                        ? "text-blue-500 dark:text-blue-400"
                        : isAfter
                          ? "text-amber-500 dark:text-amber-400"
                          : "text-muted-foreground"
                      : ""
                  }
                >
                  {line || "\u00A0"}
                </div>
              )
            })}
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2">
            <CheckCircle className="h-5 w-5 opacity-50" />
            <p>No trigger operations in the graph.</p>
            <p className="text-label">Drag a Table Source + Spatial Op to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
