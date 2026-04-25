import { useResultsStore, type ExecutionResult } from "@/stores/resultsStore"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, Trash2, Download } from "lucide-react"

const STATUS_CONFIG = {
  running: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10", label: "Running" },
  completed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "Done" },
  failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Failed" },
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return iso
  }
}

function ResultRow({ result }: { result: ExecutionResult }) {
  const cfg = STATUS_CONFIG[result.status]
  const Icon = cfg.icon

  return (
    <div className={`flex items-center gap-2 rounded px-2 py-1.5 ${cfg.bg}`}>
      <Icon size={14} className={`shrink-0 ${cfg.color} ${result.status === "running" ? "animate-spin" : ""}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{result.name}</span>
          <Badge variant="secondary" className="text-label-sm shrink-0">{result.type}</Badge>
          {result.capability && (
            <Badge variant="outline" className="text-label-sm shrink-0">{result.capability}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-label text-muted-foreground mt-0.5">
          {result.layerName && <span>Layer: {result.layerName}</span>}
          {result.featureCount !== undefined && <span>{result.featureCount} features</span>}
          {result.durationMs !== undefined && <span>{(result.durationMs / 1000).toFixed(1)}s</span>}
          {result.errorMessage && (
            <span className="text-red-500 truncate">{result.errorMessage}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0 gap-0.5">
        <span className="text-label text-muted-foreground/60">{formatTime(result.createdAt)}</span>
        {result.status === "completed" && result.resultPath && (
          <a
            href={`/jobs/${result.id.replace("rule-", "")}/download`}
            className="text-label-sm text-primary hover:underline flex items-center gap-0.5"
            title="Download result"
          >
            <Download size={9} /> GPKG
          </a>
        )}
      </div>
    </div>
  )
}

export function ResultsPanel() {
  const results = useResultsStore((s) => s.results)
  const clearResults = useResultsStore((s) => s.clearResults)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-2 py-0.5 border-b">
        <div className="flex items-center gap-1.5">
          <span className="text-label text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </span>
          {results.some((r) => r.status === "running") && (
            <span className="flex items-center gap-1 text-label text-blue-500">
              <Loader2 size={10} className="animate-spin" /> Running
            </span>
          )}
        </div>
        {results.length > 0 && (
          <button onClick={clearResults} className="text-label text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Trash2 size={10} /> Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-2">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-xs text-muted-foreground">No execution results yet.</p>
            <p className="text-label text-muted-foreground/60 mt-1">
              Select a rule in the Inspector and click "Run on layer" to see results here.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {results.map((r) => (
              <ResultRow key={r.id} result={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
