/**
 * CatalogWorkspace — refonte découverte et import du catalogue.
 * Issue #141 (Sprint R-6) : workspace dédié 3-zones eliminant la duplication.
 *
 * Layout : [sidebar filtres] | [grid cards] | [inspector metadata]
 */

import { useEffect, useState, useCallback, Suspense, lazy } from "react"
import { Search, Star, X, Globe, Map, Layers, Compass, ChevronRight, Download, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { useCatalogStore, detectSpatialContext } from "@/stores/catalogStore"
import { useCatalogFavoritesStore } from "@/stores/catalogFavoritesStore"
import { useDatasetStore } from "@/stores/datasetStore"
import { useUIStore } from "@/stores/uiStore"
import { useMapViewStore, layerKey } from "@/stores/mapViewStore"
import { useExternalLayersStore } from "@/stores/externalLayersStore"
import { importDatasetFromUrl } from "@/api/client"
import { navigateToView } from "@/router"
import {
  BasemapCard,
  FluxCard,
  OpenDataCard,
  ProjectionCard,
} from "@/components/CatalogCard"
import { SmartSuggestions } from "@/components/SmartSuggestions"
import { CatalogImportDialog } from "@/components/CatalogImportDialog"
import type { CatalogDomain } from "@/types/catalog"
import type {
  BasemapEntry,
  ProjectionEntry,
  FluxEntry,
  OpenDataEntry,
  CatalogEntry,
} from "@/types/catalog"

// Lazy import of mini-map to avoid loading MapLibre until needed
const CatalogExtentMap = lazy(() =>
  import("./CatalogExtentMap").then((m) => ({ default: m.CatalogExtentMap })),
)

// ---------- Domain definitions ----------

interface DomainDef {
  value: CatalogDomain
  label: string
  icon: typeof Map
  description: string
}

const DOMAINS: DomainDef[] = [
  { value: "basemap", label: "Basemaps", icon: Map, description: "Fonds de carte" },
  { value: "flux", label: "Flux OGC", icon: Layers, description: "WMS, WFS, WMTS, OGC Features" },
  { value: "opendata", label: "Open Data", icon: Globe, description: "Jeux de données téléchargeables" },
  { value: "projection", label: "Projections", icon: Compass, description: "Systèmes de coordonnées" },
]

// ---------- Protocol / provider filter helpers ----------

function getProtocols(entries: FluxEntry[]): string[] {
  return Array.from(new Set(entries.map((e) => e.protocol))).sort()
}

function getProviders(entries: CatalogEntry[]): string[] {
  return Array.from(new Set(entries.map((e) => e.provider))).sort()
}

// ---------- Sidebar ----------

interface SidebarProps {
  domain: CatalogDomain
  onDomainChange: (d: CatalogDomain) => void
  protocolFilter: string | null
  onProtocolFilter: (p: string | null) => void
  providerFilter: string | null
  onProviderFilter: (p: string | null) => void
  availableProtocols: string[]
  availableProviders: string[]
  favoritesCount: number
  showFavoritesOnly: boolean
  onToggleFavorites: () => void
  totalEntries: number
}

function Sidebar({
  domain,
  onDomainChange,
  protocolFilter,
  onProtocolFilter,
  providerFilter,
  onProviderFilter,
  availableProtocols,
  availableProviders,
  favoritesCount,
  showFavoritesOnly,
  onToggleFavorites,
  totalEntries,
}: SidebarProps) {
  return (
    <div className="flex flex-col h-full border-r overflow-hidden w-(--width-sidebar) shrink-0">
      <div className="px-3 py-2.5 border-b">
        <h3 className="text-xs font-semibold text-foreground">Catalog</h3>
        <p className="text-label text-muted-foreground mt-0.5">{totalEntries} entries</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 py-2 space-y-0.5">
          {/* Domains */}
          <p className="px-2 pt-1 pb-1 text-label font-semibold uppercase tracking-wider text-muted-foreground">
            Domain
          </p>
          {DOMAINS.map((d) => {
            const Icon = d.icon
            return (
              <button
                key={d.value}
                onClick={() => onDomainChange(d.value)}
                className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  domain === d.value
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <Icon size={13} className="shrink-0" />
                {d.label}
                {domain === d.value && <ChevronRight size={11} className="ml-auto" />}
              </button>
            )
          })}
        </div>

        {/* Favorites section */}
        <div className="px-2 py-2 border-t mt-1">
          <p className="px-2 pt-1 pb-1 text-label font-semibold uppercase tracking-wider text-muted-foreground">
            Saved
          </p>
          <button
            onClick={onToggleFavorites}
            className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
              showFavoritesOnly
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium"
                : "text-foreground hover:bg-accent"
            }`}
          >
            <Star size={13} className="shrink-0" fill={showFavoritesOnly ? "currentColor" : "none"} />
            Favorites
            {favoritesCount > 0 && (
              <Badge variant="secondary" className="text-label-sm ml-auto h-4 min-w-4 px-1">
                {favoritesCount}
              </Badge>
            )}
          </button>
        </div>

        {/* Protocol filter (Flux only) */}
        {domain === "flux" && availableProtocols.length > 0 && (
          <div className="px-2 py-2 border-t">
            <p className="px-2 pt-1 pb-1 text-label font-semibold uppercase tracking-wider text-muted-foreground">
              Protocol
            </p>
            {availableProtocols.map((p) => (
              <button
                key={p}
                onClick={() => onProtocolFilter(protocolFilter === p ? null : p)}
                className={`w-full flex items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors ${
                  protocolFilter === p
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <span className="font-mono uppercase text-label">{p}</span>
                {protocolFilter === p && (
                  <X size={10} className="ml-auto" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Provider filter */}
        {availableProviders.length > 0 && (
          <div className="px-2 py-2 border-t">
            <p className="px-2 pt-1 pb-1 text-label font-semibold uppercase tracking-wider text-muted-foreground">
              Provider
            </p>
            {availableProviders.map((p) => (
              <button
                key={p}
                onClick={() => onProviderFilter(providerFilter === p ? null : p)}
                className={`w-full flex items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors ${
                  providerFilter === p
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <span className="truncate">{p}</span>
                {providerFilter === p && (
                  <X size={10} className="ml-auto shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ---------- Inline inspector ----------

type AnyEntry = BasemapEntry | FluxEntry | OpenDataEntry | ProjectionEntry

interface InspectorProps {
  entry: AnyEntry | null
  domain: CatalogDomain
  epsgCodes: string[]
  onClose: () => void
  onImport?: (entry: OpenDataEntry) => Promise<void>
  onImportAdvanced?: (entry: AnyEntry) => void
  importing?: boolean
  imported?: boolean
}

function Inspector({
  entry,
  domain,
  epsgCodes,
  onClose,
  onImport,
  onImportAdvanced,
  importing,
  imported,
}: InspectorProps) {
  if (!entry) {
    return (
      <div className="w-(--width-inspector) shrink-0 border-l flex flex-col items-center justify-center text-center px-4">
        <Layers size={24} className="text-muted-foreground/30 mb-2" />
        <p className="text-label-lg text-muted-foreground">Select an entry to see details</p>
      </div>
    )
  }

  const bbox: [number, number, number, number] | null = (() => {
    if (domain === "projection") {
      const pe = entry as ProjectionEntry
      if (pe.bounds && pe.bounds.length === 4) {
        return pe.bounds as [number, number, number, number]
      }
    }
    return null
  })()

  return (
    <div className="w-(--width-inspector) shrink-0 border-l flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b">
        <span className="text-xs font-semibold flex-1 truncate">{entry.name}</span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close inspector"
        >
          <X size={13} />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-3 space-y-3">
          {/* Extent mini-map — projection and flux have bounds */}
          {bbox && (
            <div>
              <p className="text-label font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Extent
              </p>
              <Suspense
                fallback={
                  <div
                    className="rounded-md border bg-muted/30 flex items-center justify-center"
                    style={{ height: 150 }}
                  >
                    <span className="text-label text-muted-foreground">Loading...</span>
                  </div>
                }
              >
                <CatalogExtentMap bbox={bbox} label={entry.name} />
              </Suspense>
              <p className="text-label-sm text-muted-foreground/60 mt-1 font-mono">
                {bbox.map((v) => v.toFixed(4)).join(", ")}
              </p>
            </div>
          )}

          {/* Description */}
          {entry.description && (
            <div>
              <p className="text-label font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Description
              </p>
              <p className="text-label-lg text-foreground leading-relaxed">
                {entry.description}
              </p>
            </div>
          )}

          {/* Provider / Tags */}
          <div>
            <p className="text-label font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Provider
            </p>
            <Badge variant="outline" className="text-label">
              {entry.provider}
            </Badge>
          </div>

          {/* Domain-specific fields */}
          <DomainFields entry={entry} domain={domain} epsgCodes={epsgCodes} />

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <div>
              <p className="text-label font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Tags
              </p>
              <div className="flex flex-wrap gap-1">
                {entry.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-label-sm">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Import action for OpenData */}
          {domain === "opendata" && onImport && (
            <div className="pt-1 space-y-1.5">
              <OpenDataImportButton
                entry={entry as OpenDataEntry}
                onImport={onImport}
                importing={importing ?? false}
                imported={imported ?? false}
              />
              {onImportAdvanced && !(imported ?? false) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-label-lg gap-1.5"
                  onClick={() => onImportAdvanced(entry)}
                >
                  <MapPin size={12} />
                  Import with bbox...
                </Button>
              )}
            </div>
          )}

          {/* Import action for WFS/OGC flux */}
          {domain === "flux" && onImportAdvanced && (
            ((entry as FluxEntry).protocol === "wfs" || (entry as FluxEntry).protocol === "ogc-features") && (
              <div className="pt-1">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full h-7 text-label-lg gap-1.5"
                  onClick={() => onImportAdvanced(entry)}
                >
                  <Download size={12} />
                  Import features (bbox)...
                </Button>
              </div>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function DomainFields({
  entry,
  domain,
  epsgCodes,
}: {
  entry: AnyEntry
  domain: CatalogDomain
  epsgCodes: string[]
}) {
  switch (domain) {
    case "projection": {
      const e = entry as ProjectionEntry
      const inUse = epsgCodes.includes(`EPSG:${e.epsg_code}`)
      return (
        <>
          <InspectorRow label="EPSG" value={
            <span className="font-mono text-primary">EPSG:{e.epsg_code}</span>
          } />
          <InspectorRow label="Unit" value={e.unit} />
          <InspectorRow label="Area" value={e.area_of_use} />
          {inUse && (
            <Badge variant="default" className="text-label-sm">Active in project</Badge>
          )}
        </>
      )
    }
    case "basemap": {
      const e = entry as BasemapEntry
      return (
        <>
          <InspectorRow label="Protocol" value={e.protocol.toUpperCase()} />
          <InspectorRow label="Max zoom" value={String(e.max_zoom)} />
          {e.attribution && (
            <InspectorRow label="Attribution" value={e.attribution} />
          )}
        </>
      )
    }
    case "flux": {
      const e = entry as FluxEntry
      return (
        <>
          <InspectorRow label="Protocol" value={
            <span className="font-mono uppercase text-label">{e.protocol}</span>
          } />
          <InspectorRow label="Default CRS" value={
            <span className="font-mono text-label">{e.default_crs}</span>
          } />
          {e.layer_name && <InspectorRow label="Layer" value={e.layer_name} />}
          <InspectorRow label="Service URL" value={
            <a
              href={e.service_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all text-label"
            >
              {e.service_url}
            </a>
          } />
        </>
      )
    }
    case "opendata": {
      const e = entry as OpenDataEntry
      return (
        <>
          {e.format && <InspectorRow label="Format" value={e.format.toUpperCase()} />}
          {e.license && <InspectorRow label="Licence" value={e.license} />}
          {e.update_frequency && <InspectorRow label="Update" value={e.update_frequency} />}
          {e.spatial_coverage && <InspectorRow label="Coverage" value={e.spatial_coverage} />}
          {e.source_url && (
            <InspectorRow label="Source" value={
              <a
                href={e.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all text-label"
              >
                Open source
              </a>
            } />
          )}
        </>
      )
    }
  }
}

function InspectorRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-label text-muted-foreground shrink-0">{label}</span>
      <span className="text-label text-right break-all">{value}</span>
    </div>
  )
}

function OpenDataImportButton({
  entry,
  onImport,
  importing,
  imported,
}: {
  entry: OpenDataEntry
  onImport: (e: OpenDataEntry) => Promise<void>
  importing: boolean
  imported: boolean
}) {
  if (!entry.download_url) return null
  if (imported) {
    return (
      <Badge variant="default" className="text-label w-full justify-center py-1">
        Imported
      </Badge>
    )
  }
  return (
    <Button
      variant="default"
      size="sm"
      className="w-full h-7 text-label-lg gap-1.5"
      onClick={() => onImport(entry)}
      disabled={importing}
    >
      <Download size={12} />
      {importing ? "Importing..." : "Import to project"}
    </Button>
  )
}

// ---------- Grid ----------

interface GridProps {
  domain: CatalogDomain
  entries: AnyEntry[]
  selectedId: string | null
  onSelect: (entry: AnyEntry) => void
  importing: string | null
  imported: Set<string>
  onImport: (entry: OpenDataEntry) => Promise<void>
  onApplyBasemap: (id: string) => void
  onAddFluxToMap: (entry: FluxEntry) => void
  onImportAdvanced: (entry: AnyEntry) => void
  epsgCodes: string[]
}

function CatalogGrid({
  domain,
  entries,
  selectedId,
  onSelect,
  importing,
  imported,
  onImport,
  onApplyBasemap,
  onAddFluxToMap,
  onImportAdvanced,
  epsgCodes,
}: GridProps) {
  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-16">
        <p className="text-sm text-muted-foreground">No results</p>
        <p className="text-label-lg text-muted-foreground/60 mt-1">
          Try a different search or filter
        </p>
      </div>
    )
  }

  const gridCls =
    domain === "projection"
      ? "flex flex-col gap-1.5 p-4"
      : "grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3"

  return (
    <div className={gridCls}>
      {entries.map((entry) => {
        const isSelected = selectedId === entry.id

        switch (domain) {
          case "basemap":
            return (
              <BasemapCard
                key={entry.id}
                entry={entry as BasemapEntry}
                selected={isSelected}
                onSelect={() => onSelect(entry)}
                onApply={() => onApplyBasemap((entry as BasemapEntry).id.replace("basemap:", ""))}
              />
            )
          case "flux":
            return (
              <FluxCard
                key={entry.id}
                entry={entry as FluxEntry}
                selected={isSelected}
                onSelect={() => onSelect(entry)}
                onAddToMap={() => onAddFluxToMap(entry as FluxEntry)}
                onImport={
                  ((entry as FluxEntry).protocol === "wfs" || (entry as FluxEntry).protocol === "ogc-features")
                    ? () => onImportAdvanced(entry)
                    : undefined
                }
              />
            )
          case "opendata":
            return (
              <OpenDataCard
                key={entry.id}
                entry={entry as OpenDataEntry}
                selected={isSelected}
                onSelect={() => onSelect(entry)}
                onImport={onImport}
                onImportAdvanced={() => onImportAdvanced(entry)}
                importing={importing === entry.id}
                imported={imported.has(entry.id)}
              />
            )
          case "projection":
            return (
              <ProjectionCard
                key={entry.id}
                entry={entry as ProjectionEntry}
                selected={isSelected}
                onSelect={() => onSelect(entry)}
                inUse={epsgCodes.includes(`EPSG:${(entry as ProjectionEntry).epsg_code}`)}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}

// ---------- Main workspace ----------

export function CatalogWorkspace() {
  const {
    tab, search, loading,
    projections, basemaps, flux, opendata,
    spatialContext,
    setTab, setSearch, fetchTab, fetchProviders, setSpatialContext,
  } = useCatalogStore()

  const datasets = useDatasetStore((s) => s.datasets)
  const addDataset = useDatasetStore((s) => s.addDataset)
  const addLayer = useMapViewStore((s) => s.addLayer)
  const setBasemap = useMapViewStore((s) => s.setBasemap)
  const addFluxLayer = useExternalLayersStore((s) => s.addFluxLayer)
  const hasLayer = useExternalLayersStore((s) => s.hasLayer)

  const favorites = useCatalogFavoritesStore((s) => s.favorites)

  const [selectedEntry, setSelectedEntry] = useState<AnyEntry | null>(null)
  const [protocolFilter, setProtocolFilter] = useState<string | null>(null)
  const [providerFilter, setProviderFilter] = useState<string | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [imported, setImported] = useState<Set<string>>(new Set())
  const [importDialogEntry, setImportDialogEntry] = useState<AnyEntry | null>(null)

  // Sync spatial context
  useEffect(() => {
    const ctx = detectSpatialContext(datasets)
    setSpatialContext(ctx)
  }, [datasets, setSpatialContext])

  // Initial fetch
  useEffect(() => {
    fetchTab()
    fetchProviders()
  }, [])

  // Reset filters when domain changes
  const handleDomainChange = useCallback((d: CatalogDomain) => {
    setTab(d)
    setProtocolFilter(null)
    setProviderFilter(null)
    setSelectedEntry(null)
    setShowFavoritesOnly(false)
  }, [setTab])

  // Get current domain entries
  const rawEntries: AnyEntry[] = (() => {
    switch (tab) {
      case "basemap": return basemaps
      case "flux": return flux
      case "opendata": return opendata
      case "projection": return projections
    }
  })()

  // Apply favorites filter
  const favSet = new Set(favorites.map((f) => f.id))
  const afterFav = showFavoritesOnly
    ? rawEntries.filter((e) => favSet.has(e.id))
    : rawEntries

  // Apply protocol filter
  const afterProtocol = protocolFilter && tab === "flux"
    ? afterFav.filter((e) => (e as FluxEntry).protocol === protocolFilter)
    : afterFav

  // Apply provider filter
  const filteredEntries = providerFilter
    ? afterProtocol.filter((e) => e.provider === providerFilter)
    : afterProtocol

  const availableProtocols = tab === "flux" ? getProtocols(rawEntries as FluxEntry[]) : []
  const availableProviders = getProviders(rawEntries)

  // Import handler
  const handleImport = useCallback(async (entry: OpenDataEntry) => {
    if (!entry.download_url) return
    setImporting(entry.id)
    try {
      const ds = await importDatasetFromUrl(entry.download_url, entry.name)
      addDataset(ds)
      for (const l of ds.layers ?? []) {
        addLayer(layerKey(ds.id, l.name))
      }
      setImported((s) => new Set(s).add(entry.id))
      toast.success(`"${entry.name}" imported`)
    } catch (err) {
      toast.error("Import failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setImporting(null)
    }
  }, [addDataset, addLayer])

  // Open advanced import dialog (for WFS/OGC Features + OpenData with bbox)
  const handleOpenImportDialog = useCallback((entry: AnyEntry) => {
    setImportDialogEntry(entry)
  }, [])

  // Handle import dialog result
  const handleImportDialogResult = useCallback((result: any) => {
    // External layer (raster flux) — add to map
    if (result.type === "external_layer") {
      toast.success(`"${result.name}" added as external layer`)
      setImportDialogEntry(null)
      return
    }

    // Dataset imported — add to store
    const ds = {
      id: result.id,
      name: result.name,
      source_path: result.source_path,
      format: result.format,
      crs: result.crs,
      layers: result.layers ?? [],
      styles: result.styles ?? [],
      created_at: result.created_at,
      file_size: result.file_size,
    }
    addDataset(ds as any)
    for (const l of ds.layers) {
      const ln = (l as any).name
      if (ln) addLayer(layerKey(ds.id, ln))
    }
    setImported((s) => new Set(s).add(importDialogEntry?.id ?? ""))
    setImportDialogEntry(null)
    toast.success(`"${result.name}" imported (${result.feature_count ?? "?"} features)`)
  }, [addDataset, addLayer, importDialogEntry])

  // Add a flux layer to the map (#190)
  const handleAddFluxToMap = useCallback((entry: FluxEntry) => {
    const id = `flux::${entry.id}`
    if (hasLayer(id)) {
      toast.info(`"${entry.name}" is already on the map`)
    } else {
      addFluxLayer(entry)
      toast.success(`"${entry.name}" added to map`)
    }
    navigateToView("map")
  }, [addFluxLayer, hasLayer])

  const totalEntries = basemaps.length + flux.length + opendata.length + projections.length

  // Memoized callbacks to avoid re-rendering child components on each render (#199)
  const handleToggleFavorites = useCallback(() => setShowFavoritesOnly((v) => !v), [])
  const handleSelectEntry = useCallback((entry: AnyEntry) => {
    setSelectedEntry((prev) => prev?.id === entry.id ? null : entry)
  }, [])
  const handleApplyBasemap = useCallback((id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setBasemap(id as any)
    toast.success("Basemap applied")
  }, [setBasemap])
  const handleCloseInspector = useCallback(() => setSelectedEntry(null), [])

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Left sidebar */}
      <Sidebar
        domain={tab}
        onDomainChange={handleDomainChange}
        protocolFilter={protocolFilter}
        onProtocolFilter={setProtocolFilter}
        providerFilter={providerFilter}
        onProviderFilter={setProviderFilter}
        availableProtocols={availableProtocols}
        availableProviders={availableProviders}
        favoritesCount={favorites.length}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={handleToggleFavorites}
        totalEntries={totalEntries}
      />

      {/* Center: search + grid */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Search bar */}
        <div className="border-b px-3 py-2 flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 rounded-md border bg-background px-3 py-1.5 focus-within:border-primary transition-colors">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${DOMAINS.find((d) => d.value === tab)?.label ?? ""}...`}
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Spatial context hint */}
          {spatialContext.country && !search && (
            <Badge variant="outline" className="text-label shrink-0">
              {spatialContext.country}
            </Badge>
          )}

          {/* Stats */}
          {!loading && (
            <span className="text-label text-muted-foreground shrink-0">
              {filteredEntries.length} result{filteredEntries.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Smart suggestions — contextual shortcuts based on detected country (#189) */}
        {spatialContext.country && !search && (
          <SmartSuggestions
            country={spatialContext.country}
            epsgCodes={spatialContext.epsgCodes}
          />
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="text-xs text-muted-foreground">Loading...</span>
          </div>
        )}

        {/* Grid */}
        {!loading && (
          <ScrollArea className="flex-1">
            <CatalogGrid
              domain={tab}
              entries={filteredEntries}
              selectedId={selectedEntry?.id ?? null}
              onSelect={handleSelectEntry}
              importing={importing}
              imported={imported}
              onImport={handleImport}
              onApplyBasemap={handleApplyBasemap}
              onAddFluxToMap={handleAddFluxToMap}
              onImportAdvanced={handleOpenImportDialog}
              epsgCodes={spatialContext.epsgCodes}
            />
          </ScrollArea>
        )}
      </div>

      {/* Right inspector */}
      <Inspector
        entry={selectedEntry}
        domain={tab}
        epsgCodes={spatialContext.epsgCodes}
        onClose={handleCloseInspector}
        onImport={handleImport}
        onImportAdvanced={handleOpenImportDialog}
        importing={importing === selectedEntry?.id}
        imported={selectedEntry ? imported.has(selectedEntry.id) : false}
      />

      {/* Import dialog with bbox selection */}
      {importDialogEntry && (
        <CatalogImportDialog
          entry={importDialogEntry as any}
          onClose={() => setImportDialogEntry(null)}
          onImported={handleImportDialogResult}
        />
      )}
    </div>
  )
}
