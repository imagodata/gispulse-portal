/**
 * components/schedules/ScheduleForm.tsx — Create / edit schedule form.
 *
 * Features:
 * - Name field
 * - Cron expression with quick presets + free-form input
 * - Client-side next-run preview (no external dependency, pure JS Date math)
 * - Dataset selector (fetched from store)
 * - Enable/disable toggle
 * - Optional "Run Now" button for edit mode
 */

import { useState, useMemo, useCallback } from "react"
import { Clock, Play, ChevronDown, ChevronUp, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { CreateSchedulePayload, UpdateSchedulePayload, ScheduledPipeline } from "@/api/schedules"

// ---------------------------------------------------------------------------
// Cron presets
// ---------------------------------------------------------------------------

interface CronPreset {
  label: string
  value: string
  description: string
}

const CRON_PRESETS: CronPreset[] = [
  { label: "Every hour", value: "0 * * * *", description: "At minute 0 of every hour" },
  { label: "Every 6 hours", value: "0 */6 * * *", description: "At minute 0, every 6 hours" },
  { label: "Daily at midnight", value: "0 0 * * *", description: "Every day at 00:00" },
  { label: "Daily at noon", value: "0 12 * * *", description: "Every day at 12:00" },
  { label: "Weekly Mon 8am", value: "0 8 * * 1", description: "Every Monday at 08:00" },
  { label: "Monthly 1st", value: "0 0 1 * *", description: "1st of every month at 00:00" },
]

// ---------------------------------------------------------------------------
// Minimal cron next-run parser (no external lib)
// Handles standard 5-field cron only. Returns null on unsupported expressions.
// ---------------------------------------------------------------------------

function parseCronField(field: string, min: number, max: number): number[] | null {
  const values: number[] = []
  if (field === "*") {
    for (let i = min; i <= max; i++) values.push(i)
    return values
  }
  for (const part of field.split(",")) {
    if (part.includes("/")) {
      const [range, step] = part.split("/")
      const stepNum = parseInt(step, 10)
      if (isNaN(stepNum) || stepNum <= 0) return null
      const start = range === "*" ? min : parseInt(range, 10)
      if (isNaN(start)) return null
      for (let i = start; i <= max; i += stepNum) values.push(i)
    } else if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number)
      if (isNaN(lo) || isNaN(hi)) return null
      for (let i = lo; i <= hi; i++) values.push(i)
    } else {
      const n = parseInt(part, 10)
      if (isNaN(n)) return null
      values.push(n)
    }
  }
  return values.filter((v) => v >= min && v <= max)
}

function nextCronRun(cron: string, from: Date = new Date()): Date | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [mField, hField, domField, monField, dowField] = parts
  const minutes = parseCronField(mField, 0, 59)
  const hours = parseCronField(hField, 0, 23)
  const doms = parseCronField(domField, 1, 31)
  const months = parseCronField(monField, 1, 12)
  const dows = parseCronField(dowField, 0, 6)
  if (!minutes || !hours || !doms || !months || !dows) return null

  // Advance one minute to not match "now"
  const candidate = new Date(from.getTime() + 60_000)
  candidate.setSeconds(0, 0)

  // Search up to 4 years ahead
  const limit = new Date(from.getTime() + 4 * 365 * 24 * 60 * 60 * 1000)

  while (candidate <= limit) {
    if (!months.includes(candidate.getMonth() + 1)) {
      candidate.setMonth(candidate.getMonth() + 1, 1)
      candidate.setHours(0, 0, 0, 0)
      continue
    }
    if (!doms.includes(candidate.getDate()) || !dows.includes(candidate.getDay())) {
      candidate.setDate(candidate.getDate() + 1)
      candidate.setHours(0, 0, 0, 0)
      continue
    }
    if (!hours.includes(candidate.getHours())) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0)
      continue
    }
    if (!minutes.includes(candidate.getMinutes())) {
      const nextMin = minutes.find((m) => m > candidate.getMinutes())
      if (nextMin !== undefined) {
        candidate.setMinutes(nextMin, 0, 0)
      } else {
        candidate.setHours(candidate.getHours() + 1, 0, 0, 0)
      }
      continue
    }
    return candidate
  }
  return null
}

function formatNextRun(date: Date | null): string {
  if (!date) return "—"
  const diff = date.getTime() - Date.now()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 1) return `in ${days} days (${date.toLocaleString()})`
  if (days === 1) return `tomorrow at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  if (hours >= 1) return `in ${hours}h ${mins % 60}m`
  if (mins >= 1) return `in ${mins} min`
  return date.toLocaleString()
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ScheduleFormProps {
  /** Existing schedule — if provided, renders in "edit" mode */
  schedule?: ScheduledPipeline
  onSubmit: (payload: CreateSchedulePayload | UpdateSchedulePayload) => Promise<void>
  onCancel: () => void
  /** Called when "Run Now" is clicked in edit mode */
  onRunNow?: () => void
  runNowLoading?: boolean
}

// ---------------------------------------------------------------------------
// ScheduleForm
// ---------------------------------------------------------------------------

export function ScheduleForm({
  schedule,
  onSubmit,
  onCancel,
  onRunNow,
  runNowLoading = false,
}: ScheduleFormProps) {
  const isEdit = !!schedule

  const [name, setName] = useState(schedule?.name ?? "")
  const [cron, setCron] = useState(schedule?.cron ?? "0 * * * *")
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true)
  const [showPresets, setShowPresets] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nextRun = useMemo(() => {
    const date = nextCronRun(cron)
    return formatNextRun(date)
  }, [cron])

  const cronValid = useMemo(() => nextCronRun(cron) !== null, [cron])

  const applyPreset = useCallback((preset: CronPreset) => {
    setCron(preset.value)
    setShowPresets(false)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    if (!cronValid) {
      setError("Invalid cron expression.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      await onSubmit({ name: name.trim(), cron, enabled })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Name */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground font-medium">Name *</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Daily city boundary sync"
          required
          autoFocus
        />
      </label>

      {/* Cron expression */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground font-medium">Cron Expression *</span>

        {/* Input + preset toggle */}
        <div className="flex gap-2">
          <Input
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            placeholder="0 * * * *"
            className={cn(
              "font-mono text-xs",
              !cronValid && cron.trim() && "border-destructive focus-visible:border-destructive"
            )}
            aria-label="Cron expression"
          />
          <button
            type="button"
            onClick={() => setShowPresets((v) => !v)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap"
            aria-expanded={showPresets}
            aria-label="Toggle presets"
          >
            Presets
            {showPresets ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Preset list */}
        {showPresets && (
          <div className="rounded-lg border border-border bg-background shadow-sm overflow-hidden">
            {CRON_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => applyPreset(preset)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-accent transition-colors text-left",
                  cron === preset.value && "bg-primary/5 text-primary"
                )}
              >
                <span className="font-medium">{preset.label}</span>
                <span className="text-muted-foreground font-mono ml-2">{preset.value}</span>
              </button>
            ))}
          </div>
        )}

        {/* Next run preview */}
        <div className={cn(
          "flex items-center gap-1.5 text-xs",
          cronValid ? "text-muted-foreground" : "text-destructive"
        )}>
          <Clock size={11} className="shrink-0" />
          {cronValid
            ? <span>Next run: <span className="font-medium text-foreground">{nextRun}</span></span>
            : <span>Invalid cron expression</span>
          }
        </div>
      </div>

      {/* Enabled toggle */}
      <label className="flex items-center justify-between">
        <div>
          <span className="text-xs font-medium">Enable schedule</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            When disabled, the schedule will not run automatically.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            enabled ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
              enabled ? "translate-x-4" : "translate-x-0"
            )}
          />
        </button>
      </label>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        {/* Run Now — only in edit mode */}
        {isEdit && onRunNow && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRunNow}
            disabled={runNowLoading || loading}
            className="gap-1.5"
          >
            <Play size={12} />
            {runNowLoading ? "Running..." : "Run Now"}
          </Button>
        )}

        <div className={cn("flex gap-2", !isEdit || !onRunNow ? "ml-auto" : "")}>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading || !cronValid}>
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Schedule"}
          </Button>
        </div>
      </div>
    </form>
  )
}
