/**
 * CatalogCard — composant résultat universel pour le catalog workspace.
 * Issue #142 (Sprint R-6) : Cards par type (OGC, OpenData, Basemap, Projection)
 * avec badges provider/format, actions Import / Favorite / Details.
 */

import { useState } from "react"
import { Star, Download, Info, Globe, Map, Layers, Compass, MapPin, Copy, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCatalogFavoritesStore } from "@/stores/catalogFavoritesStore"
import { PROTOCOL_COLOR } from "@/utils/protocolColor"
import type {
  CatalogEntry,
  BasemapEntry,
  ProjectionEntry,
  FluxEntry,
  OpenDataEntry,
  CatalogDomain,
} from "@/types/catalog"

// ---------- Domain icon helper ----------

function DomainIcon({ domain }: { domain: CatalogDomain }) {
  const cls = "shrink-0 text-muted-foreground"
  switch (domain) {
    case "basemap": return <Map size={14} className={cls} />
    case "flux": return <Layers size={14} className={cls} />
    case "opendata": return <Globe size={14} className={cls} />
    case "projection": return <Compass size={14} className={cls} />
  }
}

// ---------- Star button ----------

function StarButton({
  entry,
  size = 14,
}: {
  entry: CatalogEntry & { domain: CatalogDomain }
  size?: number
}) {
  const { isFavorite, toggleFavorite } = useCatalogFavoritesStore()
  const starred = isFavorite(entry.id)

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        toggleFavorite({
          id: entry.id,
          domain: entry.domain,
          name: entry.name,
          provider: entry.provider,
          description: entry.description,
          starredAt: new Date().toISOString(),
        })
      }}
      aria-label={starred ? "Remove from favorites" : "Add to favorites"}
      className={`rounded p-0.5 transition-colors hover:text-amber-500 ${
        starred ? "text-amber-500" : "text-muted-foreground/40"
      }`}
    >
      <Star size={size} fill={starred ? "currentColor" : "none"} />
    </button>
  )
}

// ---------- Base card shell ----------

interface CardShellProps {
  entry: CatalogEntry & { domain: CatalogDomain }
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

function CardShell({ entry, selected, onClick, children, footer }: CardShellProps) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`flex flex-col gap-1.5 rounded-lg border p-3 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        selected
          ? "border-primary/60 bg-primary/5"
          : "hover:bg-accent hover:border-border/80"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <DomainIcon domain={entry.domain} />
        <span className="text-xs font-medium leading-tight flex-1 min-w-0 line-clamp-1">
          {entry.name}
        </span>
        <StarButton entry={entry} />
      </div>

      {children}

      {footer && <div className="mt-auto pt-1">{footer}</div>}
    </div>
  )
}

// ---------- Basemap card ----------

interface BasemapCardProps {
  entry: BasemapEntry
  selected: boolean
  onSelect: () => void
  onApply: () => void
}

export function BasemapCard({ entry, selected, onSelect, onApply }: BasemapCardProps) {
  return (
    <CardShell
      entry={{ ...entry, domain: "basemap" }}
      selected={selected}
      onClick={onSelect}
      footer={
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-label-sm">
            {entry.protocol.toUpperCase()}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-label px-2"
            onClick={(e) => { e.stopPropagation(); onApply() }}
          >
            Apply
          </Button>
        </div>
      }
    >
      <span className="text-label text-muted-foreground line-clamp-2">
        {entry.description}
      </span>
      {entry.attribution && (
        <span className="text-label-sm text-muted-foreground/60 truncate">
          {entry.attribution}
        </span>
      )}
    </CardShell>
  )
}

// ---------- Flux card ----------

interface FluxCardProps {
  entry: FluxEntry
  selected: boolean
  onSelect: () => void
  onAddToMap?: (entry: FluxEntry) => void
  onImport?: () => void
}

export function FluxCard({ entry, selected, onSelect, onAddToMap, onImport }: FluxCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(entry.service_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <CardShell
      entry={{ ...entry, domain: "flux" }}
      selected={selected}
      onClick={onSelect}
      footer={
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`rounded px-1.5 py-0.5 text-label-sm font-mono font-bold uppercase ${
              PROTOCOL_COLOR[entry.protocol] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
            }`}
          >
            {entry.protocol}
          </span>
          <Badge variant="outline" className="text-label-sm">
            {entry.provider}
          </Badge>
          <div className="ml-auto flex items-center gap-1">
            {/* Copy URL (#190) */}
            <button
              onClick={handleCopyUrl}
              aria-label="Copy service URL"
              title="Copy service URL"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            </button>
            {/* Import WFS data */}
            {onImport && (
              <button
                onClick={(e) => { e.stopPropagation(); onImport() }}
                aria-label="Import features"
                title="Import features with bbox"
                className="rounded p-0.5 text-muted-foreground hover:text-primary transition-colors"
              >
                <Download size={11} />
              </button>
            )}
            {/* Add to map (#190) */}
            {onAddToMap && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddToMap(entry) }}
                aria-label="Add to map"
                title="Add flux to map"
                className="rounded p-0.5 text-muted-foreground hover:text-primary transition-colors"
              >
                <MapPin size={11} />
              </button>
            )}
          </div>
        </div>
      }
    >
      <span className="text-label text-muted-foreground line-clamp-2">
        {entry.description}
      </span>
      {entry.layer_name && (
        <span className="text-label-sm font-mono text-muted-foreground/60 truncate">
          {entry.layer_name}
        </span>
      )}
    </CardShell>
  )
}

// ---------- OpenData card ----------

interface OpenDataCardProps {
  entry: OpenDataEntry
  selected: boolean
  onSelect: () => void
  onImport: (entry: OpenDataEntry) => Promise<void>
  onImportAdvanced?: () => void
  importing: boolean
  imported: boolean
}

export function OpenDataCard({
  entry,
  selected,
  onSelect,
  onImport,
  onImportAdvanced,
  importing,
  imported,
}: OpenDataCardProps) {
  return (
    <CardShell
      entry={{ ...entry, domain: "opendata" }}
      selected={selected}
      onClick={onSelect}
      footer={
        <div className="flex items-center gap-1.5 flex-wrap">
          {entry.format && (
            <Badge variant="secondary" className="text-label-sm font-mono uppercase">
              {entry.format}
            </Badge>
          )}
          {entry.license && (
            <span className="text-label-sm text-muted-foreground truncate max-w-[100px]">
              {entry.license}
            </span>
          )}
          <div className="ml-auto flex gap-1">
            {entry.source_url && (
              <a
                href={entry.source_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Open source"
              >
                <Info size={12} />
              </a>
            )}
            {entry.download_url && !imported && (
              <button
                onClick={(e) => { e.stopPropagation(); onImport(entry) }}
                disabled={importing}
                aria-label="Import dataset"
                className="rounded p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              >
                <Download size={12} />
              </button>
            )}
            {!entry.download_url && !imported && onImportAdvanced && (
              <button
                onClick={(e) => { e.stopPropagation(); onImportAdvanced() }}
                aria-label="Import with bbox"
                title="Import via WFS with bbox selection"
                className="rounded p-0.5 text-muted-foreground hover:text-primary transition-colors"
              >
                <MapPin size={12} />
              </button>
            )}
            {imported && (
              <Badge variant="default" className="text-label-sm h-5">
                Imported
              </Badge>
            )}
          </div>
        </div>
      }
    >
      <span className="text-label text-muted-foreground line-clamp-2">
        {entry.description}
      </span>
      {entry.update_frequency && (
        <span className="text-label-sm text-muted-foreground/70">
          {entry.update_frequency}
        </span>
      )}
    </CardShell>
  )
}

// ---------- Projection card ----------

interface ProjectionCardProps {
  entry: ProjectionEntry
  selected: boolean
  onSelect: () => void
  inUse?: boolean
}

export function ProjectionCard({ entry, selected, onSelect, inUse }: ProjectionCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(`EPSG:${entry.epsg_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <CardShell
      entry={{ ...entry, domain: "projection" }}
      selected={selected}
      onClick={onSelect}
      footer={
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="font-mono text-label text-primary hover:underline"
            aria-label="Copy EPSG code"
          >
            {copied ? "Copied!" : `EPSG:${entry.epsg_code}`}
          </button>
          <span className="text-label-sm text-muted-foreground">{entry.unit}</span>
          {inUse && (
            <Badge variant="outline" className="text-label-sm ml-auto">
              in use
            </Badge>
          )}
        </div>
      }
    >
      <span className="text-label text-muted-foreground line-clamp-2">
        {entry.area_of_use}
      </span>
    </CardShell>
  )
}
