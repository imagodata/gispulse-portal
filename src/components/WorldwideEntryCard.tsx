/**
 * WorldwideEntryCard — gallery card for a worldwide aggregator catalog entry.
 * Issue #238 (A12) — EPIC v1.9.0 #226 (global geo-data aggregator).
 *
 * Each card surfaces one `WorldwideEntry` and its lifecycle:
 *  - not yet added            → "Add as virtual dataset"
 *  - added (virtual)          → `virtual` badge + "Materialize" action
 *  - materialized (project)   → `project` badge
 *
 * The "Materialize" button stays disabled until a bbox is drawn — the
 * worldwide sources are global, so a bbox is mandatory (acceptance criterion).
 */

import { Globe, Plus, Box, CheckCircle2, Layers } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/useT"
import type { WorldwideEntry } from "@/types/catalog"
import type { DatasetMeta } from "@/types/dataset"

export interface WorldwideEntryCardProps {
  entry: WorldwideEntry
  selected: boolean
  onSelect: () => void
  /** The virtual dataset created from this entry, if any. */
  virtual: DatasetMeta | null
  /** True once the virtual dataset has been materialized to disk. */
  materialized: boolean
  busy: boolean
  onCreateVirtual: () => void
  onMaterialize: () => void
}

export function WorldwideEntryCard({
  entry,
  selected,
  onSelect,
  virtual,
  materialized,
  busy,
  onCreateVirtual,
  onMaterialize,
}: WorldwideEntryCardProps) {
  const t = useT()

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`worldwide-card-${entry.id}`}
      className={`flex flex-col gap-1.5 rounded-md border bg-card p-2.5 text-left transition-colors ${
        selected ? "border-primary ring-1 ring-primary/30" : "hover:bg-accent/40"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Globe size={14} className="shrink-0 text-muted-foreground" />
        <span className="flex-1 min-w-0 truncate text-xs font-medium">{entry.name}</span>
        {materialized ? (
          <Badge
            data-testid="worldwide-badge-project"
            className="text-label-xs h-3.5 px-1 shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
          >
            {t("worldwide.badge.project")}
          </Badge>
        ) : virtual ? (
          <Badge
            data-testid="worldwide-badge-virtual"
            className="text-label-xs h-3.5 px-1 shrink-0 bg-violet-500/10 text-violet-600 border-violet-500/20"
          >
            {t("worldwide.badge.virtual")}
          </Badge>
        ) : null}
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-label text-muted-foreground">
        <Badge variant="outline" className="text-label-xs h-3.5 px-1 uppercase">
          {entry.jurisdiction}
        </Badge>
        <span>{entry.domain}</span>
        <span className="font-mono text-label-sm">{entry.payload}</span>
        <span className="font-mono text-label-sm uppercase">{entry.protocol}</span>
      </div>

      {/* Feature count (after preview) */}
      {virtual && virtual.feature_count != null && (
        <p className="text-label-sm text-muted-foreground/70">
          {virtual.feature_count.toLocaleString()} {t("worldwide.feature_count")}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-0.5">
        {!virtual ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 flex-1 gap-1 text-label-lg"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              onCreateVirtual()
            }}
          >
            <Plus size={11} />
            {t("worldwide.action.create_virtual")}
          </Button>
        ) : materialized ? (
          <span className="flex flex-1 items-center justify-center gap-1 text-label-lg text-emerald-600">
            <CheckCircle2 size={12} />
            {t("worldwide.virtual.materialized")}
          </span>
        ) : (
          <Button
            size="sm"
            variant="default"
            className="h-6 flex-1 gap-1 text-label-lg"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              onMaterialize()
            }}
          >
            <Box size={11} />
            {t("worldwide.action.materialize")}
          </Button>
        )}
        <Layers size={11} className="shrink-0 text-muted-foreground/30" />
      </div>
    </button>
  )
}
