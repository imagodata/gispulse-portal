import { useCallback } from "react"
import { Input } from "@/components/ui/input"

interface CronParts {
  minute: string
  hour: string
  dayOfMonth: string
  month: string
  dayOfWeek: string
}

interface CronBuilderProps {
  value: string
  onChange: (cron: string) => void
}

const PRESETS: { label: string; cron: string }[] = [
  { label: "Every 15 min", cron: "*/15 * * * *" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every day midnight", cron: "0 0 * * *" },
  { label: "Every Monday 8am", cron: "0 8 * * 1" },
]

function parseCron(expr: string): CronParts {
  const parts = expr.trim().split(/\s+/)
  return {
    minute: parts[0] ?? "*",
    hour: parts[1] ?? "*",
    dayOfMonth: parts[2] ?? "*",
    month: parts[3] ?? "*",
    dayOfWeek: parts[4] ?? "*",
  }
}

function buildCron(parts: CronParts): string {
  return `${parts.minute} ${parts.hour} ${parts.dayOfMonth} ${parts.month} ${parts.dayOfWeek}`
}

export function CronBuilder({ value, onChange }: CronBuilderProps) {
  const parts = parseCron(value)

  const updatePart = useCallback(
    (key: keyof CronParts, val: string) => {
      onChange(buildCron({ ...parseCron(value), [key]: val || "*" }))
    },
    [value, onChange],
  )

  const fields: { key: keyof CronParts; label: string; placeholder: string }[] = [
    { key: "minute", label: "Min", placeholder: "0-59 or */15" },
    { key: "hour", label: "Hour", placeholder: "0-23 or *" },
    { key: "dayOfMonth", label: "Day", placeholder: "1-31 or *" },
    { key: "month", label: "Month", placeholder: "1-12 or *" },
    { key: "dayOfWeek", label: "Weekday", placeholder: "0-6 or *" },
  ]

  return (
    <div className="space-y-2">
      {/* Presets */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.cron}
            type="button"
            onClick={() => onChange(p.cron)}
            className={`rounded border px-2 py-0.5 text-label transition-colors ${
              value === p.cron
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Granular inputs */}
      <div className="grid grid-cols-5 gap-1.5">
        {fields.map((f) => (
          <div key={f.key} className="space-y-0.5">
            <label htmlFor={`cron-${f.key}`} className="text-label font-medium text-muted-foreground">
              {f.label}
            </label>
            <Input
              id={`cron-${f.key}`}
              value={parts[f.key]}
              onChange={(e) => updatePart(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="text-xs h-7 px-1.5 text-center"
            />
          </div>
        ))}
      </div>

      {/* Expression preview */}
      <div className="rounded bg-muted px-2 py-1">
        <span className="text-label text-muted-foreground mr-1.5">cron:</span>
        <code className="text-xs font-mono">{value || "* * * * *"}</code>
      </div>
    </div>
  )
}
