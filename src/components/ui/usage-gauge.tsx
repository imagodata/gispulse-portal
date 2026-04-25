import { cn } from "@/lib/utils"

interface UsageGaugeProps {
  /** Current usage value */
  value: number
  /** Maximum allowed value (plan limit) */
  max: number
  /** Label shown above the bar */
  label: string
  /** Optional unit suffix (e.g. "jobs", "GB", "requests") */
  unit?: string
  /** Optional className for the container */
  className?: string
}

/**
 * UsageGauge — Progress bar showing plan usage against limit.
 *
 * Color thresholds:
 * - < 70%: green (normal)
 * - 70-90%: amber (warning)
 * - > 90%: red (critical)
 */
export function UsageGauge({
  value,
  max,
  label,
  unit = "",
  className,
}: UsageGaugeProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const displayValue = value.toLocaleString()
  const displayMax = max.toLocaleString()

  const barColor =
    pct > 90
      ? "bg-destructive"
      : pct > 70
        ? "bg-amber-500"
        : "bg-primary"

  const textColor =
    pct > 90
      ? "text-destructive"
      : pct > 70
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground"

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn("tabular-nums", textColor)}>
          {displayValue}
          {unit ? ` ${unit}` : ""} / {displayMax}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${displayValue} of ${displayMax}${unit ? ` ${unit}` : ""}`}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-300", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
