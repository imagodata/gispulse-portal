/**
 * Shared display helpers for geospatial data formatting.
 *
 * Extracted from DatasetCard.tsx and DatasetsWorkspace.tsx to
 * eliminate duplication (audit M27).
 */

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export const FORMAT_COLORS: Record<string, string> = {
  gpkg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  geojson: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  json: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  shp: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  parquet: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  fgb: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  csv: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  tif: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  tiff: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
}

export function formatBadgeClass(fmt: string | null | undefined): string {
  const fallback = "bg-muted text-muted-foreground"
  if (!fmt) return fallback
  return FORMAT_COLORS[fmt.toLowerCase()] ?? fallback
}
