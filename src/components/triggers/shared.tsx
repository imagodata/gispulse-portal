import { Input } from "@/components/ui/input"
import type { FiredTriggerResult } from "@/types/project"

// ---------------------------------------------------------------------------
// ConfigSection
// ---------------------------------------------------------------------------

export function ConfigSection({
  title,
  icon: Icon,
  className,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-lg border p-4 space-y-4 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ToggleChip
// ---------------------------------------------------------------------------

export function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-all capitalize ${
        active
          ? "border-primary bg-primary/10 text-primary shadow-sm"
          : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent/50"
      }`}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// ToggleSwitch
// ---------------------------------------------------------------------------

export function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white dark:bg-gray-200 shadow-lg transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// LayerSelect
// ---------------------------------------------------------------------------

export function LayerSelect({ value, onChange, layers, id }: { value: string; onChange: (v: string) => void; layers: string[]; id?: string }) {
  if (layers.length > 0) {
    return (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="">Select a layer...</option>
        {layers.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
    )
  }
  return (
    <Input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="table name"
      className="text-sm"
    />
  )
}

// ---------------------------------------------------------------------------
// LiveEvalFeed
// ---------------------------------------------------------------------------

export function LiveEvalFeed({ events, onClear }: { events: FiredTriggerResult[]; onClear: () => void }) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Live eval feed</p>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-label-lg text-muted-foreground">SSE active</span>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Waiting for trigger evaluations...
        </p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {events.map((ev, i) => (
            <div
              key={ev.id ?? i}
              className={`flex items-center gap-2 text-label-lg rounded-md px-2.5 py-1.5 ${
                ev.matched
                  ? "bg-green-500/10 text-green-700 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ev.matched ? "bg-green-500" : "bg-border"}`} />
              <span className="font-mono">
                {ev.result_summary?.operation as string ?? "?"}{" "}
                {ev.result_summary?.table as string ?? ""}
              </span>
              <span className="ml-auto opacity-60">{ev.eval_time_ms.toFixed(1)}ms</span>
            </div>
          ))}
        </div>
      )}
      {events.length > 0 && (
        <button type="button" onClick={onClear} className="text-label-lg text-muted-foreground hover:text-foreground transition-colors">
          Clear
        </button>
      )}
    </div>
  )
}
