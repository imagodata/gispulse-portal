import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { useCatalogStore } from "@/stores/catalogStore"
import { useMapViewStore, layerKey } from "@/stores/mapViewStore"
import { useDatasetStore } from "@/stores/datasetStore"
import { useExternalLayersStore } from "@/stores/externalLayersStore"
import { importDatasetFromUrl } from "@/api/client"
import { PROTOCOL_COLOR } from "@/utils/protocolColor"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { CatalogDomain } from "@/types/catalog"
import type {
  BasemapEntry,
  ProjectionEntry,
  FluxEntry,
  OpenDataEntry,
} from "@/types/catalog"

const TABS: { value: CatalogDomain; label: string; icon: string }[] = [
  { value: "basemap", label: "Basemaps", icon: "\uD83D\uDDFA" },
  { value: "projection", label: "CRS", icon: "\uD83C\uDF10" },
  { value: "flux", label: "Flux", icon: "\u26A1" },
  { value: "opendata", label: "Open Data", icon: "\uD83D\uDCC2" },
]

export function CatalogPanel() {
  const { tab, search, loading, projections, basemaps, flux, opendata, setTab, setSearch, fetchTab } =
    useCatalogStore()

  useEffect(() => {
    fetchTab()
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Domain tabs */}
      <div className="flex border-b px-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-1 py-1.5 text-label-lg font-medium transition-colors ${
              tab === t.value
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="mr-0.5">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-2 py-1.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
        />
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {loading && (
          <div className="flex flex-col gap-1.5 px-2 py-2" aria-busy="true" aria-label="Loading catalog">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded px-2 py-1.5 animate-pulse">
                <div className="h-3 w-2/3 rounded bg-muted mb-1" />
                <div className="h-2.5 w-full rounded bg-muted/60" />
              </div>
            ))}
          </div>
        )}

        {!loading && tab === "basemap" && (
          <BasemapList entries={basemaps} domain="basemap" />
        )}
        {!loading && tab === "projection" && (
          <ProjectionList entries={projections} domain="projection" />
        )}
        {!loading && tab === "flux" && <FluxList entries={flux} domain="flux" />}
        {!loading && tab === "opendata" && (
          <OpenDataList entries={opendata} domain="opendata" />
        )}
      </ScrollArea>
    </div>
  )
}

function BasemapList({ entries, domain }: { entries: BasemapEntry[]; domain: CatalogDomain }) {
  const setBasemap = useMapViewStore((s) => s.setBasemap)

  if (!entries.length) return <EmptyState domain={domain} />

  return (
    <div className="flex flex-col gap-0.5 px-1 py-1">
      {entries.map((e) => (
        <button
          key={e.id}
          onClick={() => setBasemap(e.id.replace("basemap:", ""))}
          className="flex flex-col gap-0.5 rounded px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{e.name}</span>
            <Badge variant="outline" className="text-label-sm ml-auto">
              {e.protocol}
            </Badge>
          </div>
          <span className="text-label text-muted-foreground line-clamp-1">
            {e.description}
          </span>
        </button>
      ))}
    </div>
  )
}

function ProjectionList({ entries, domain }: { entries: ProjectionEntry[]; domain: CatalogDomain }) {
  const [copied, setCopied] = useState<string | null>(null)

  if (!entries.length) return <EmptyState domain={domain} />

  const handleCopy = (code: number) => {
    navigator.clipboard.writeText(`EPSG:${code}`)
    setCopied(String(code))
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="flex flex-col gap-0.5 px-1 py-1">
      {entries.map((e) => (
        <button
          key={e.id}
          onClick={() => handleCopy(e.epsg_code)}
          className="flex flex-col gap-0.5 rounded px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-label-sm font-mono">
              {copied === String(e.epsg_code) ? "Copied!" : `EPSG:${e.epsg_code}`}
            </Badge>
            <span className="font-medium flex-1 truncate">{e.name}</span>
            <span className="text-label-sm text-muted-foreground">{e.unit}</span>
          </div>
          <span className="text-label text-muted-foreground line-clamp-1">
            {e.area_of_use}
          </span>
        </button>
      ))}
    </div>
  )
}

function FluxList({ entries, domain }: { entries: FluxEntry[]; domain: CatalogDomain }) {
  const addFluxLayer = useExternalLayersStore((s) => s.addFluxLayer)
  const hasLayer = useExternalLayersStore((s) => s.hasLayer)

  const handleAdd = useCallback((entry: FluxEntry) => {
    const id = `flux::${entry.id}`
    if (hasLayer(id)) {
      toast.info(`"${entry.name}" is already on the map`)
    } else {
      addFluxLayer(entry)
      toast.success(`"${entry.name}" added to map`)
    }
  }, [addFluxLayer, hasLayer])

  if (!entries.length) return <EmptyState domain={domain} />

  return (
    <div className="flex flex-col gap-0.5 px-1 py-1">
      {entries.map((e) => {
        const added = hasLayer(`flux::${e.id}`)
        return (
          <button
            key={e.id}
            onClick={() => handleAdd(e)}
            className="flex flex-col gap-0.5 rounded px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded px-1 py-0.5 text-label-sm font-mono font-bold uppercase ${PROTOCOL_COLOR[e.protocol] ?? ""}`}
              >
                {e.protocol}
              </span>
              <span className="font-medium flex-1 truncate">{e.name}</span>
              {added ? (
                <Badge variant="default" className="text-label-sm">
                  On map
                </Badge>
              ) : (
                <Badge variant="outline" className="text-label-sm">
                  {e.provider}
                </Badge>
              )}
            </div>
            <span className="text-label text-muted-foreground line-clamp-1">
              {e.description}
            </span>
            {e.layer_name && (
              <span className="text-label-sm font-mono text-muted-foreground/70 truncate">
                {e.layer_name}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function OpenDataList({ entries, domain }: { entries: OpenDataEntry[]; domain: CatalogDomain }) {
  const addDataset = useDatasetStore((s) => s.addDataset)
  const [importing, setImporting] = useState<string | null>(null)
  const [imported, setImported] = useState<Set<string>>(new Set())
  const addLayer = useMapViewStore((s) => s.addLayer)

  if (!entries.length) return <EmptyState domain={domain} />

  const handleImport = async (entry: OpenDataEntry) => {
    if (!entry.download_url) return
    setImporting(entry.id)
    try {
      const ds = await importDatasetFromUrl(entry.download_url, entry.name)
      addDataset(ds)
      for (const l of ds.layers ?? []) {
        addLayer(layerKey(ds.id, l.name))
      }
      setImported((s) => new Set(s).add(entry.id))
    } catch (err) {
      console.error("Import failed:", err)
      toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImporting(null)
    }
  }

  return (
    <div className="flex flex-col gap-0.5 px-1 py-1">
      {entries.map((e) => (
        <div
          key={e.id}
          className="flex flex-col gap-0.5 rounded px-2 py-1.5 text-xs hover:bg-accent transition-colors cursor-default"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-medium flex-1 truncate">{e.name}</span>
            <Badge variant="outline" className="text-label-sm">
              {e.provider}
            </Badge>
            {e.format && (
              <Badge variant="secondary" className="text-label-sm font-mono uppercase">
                {e.format}
              </Badge>
            )}
          </div>
          <span className="text-label text-muted-foreground line-clamp-2">
            {e.description}
          </span>
          <div className="flex items-center gap-2">
            {e.license && (
              <span className="text-label-sm text-muted-foreground">{e.license}</span>
            )}
            {e.download_url && !imported.has(e.id) && (
              <button
                onClick={() => handleImport(e)}
                disabled={importing !== null}
                className="text-label-sm font-medium text-primary hover:underline disabled:opacity-50"
              >
                {importing === e.id ? "Importing..." : "Import"}
              </button>
            )}
            {imported.has(e.id) && (
              <span className="text-label-sm font-medium text-green-600">Imported</span>
            )}
            {e.source_url && (
              <a
                href={e.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-label-sm text-primary hover:underline"
                onClick={(ev) => ev.stopPropagation()}
              >
                Source
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const EMPTY_MESSAGES: Record<CatalogDomain, { title: string; hint: string }> = {
  basemap: {
    title: "No basemaps found",
    hint: "Try a different search term, or check your connection to the catalog backend.",
  },
  projection: {
    title: "No CRS found",
    hint: "Search by EPSG code (e.g. \"2154\") or by name (e.g. \"Lambert\").",
  },
  flux: {
    title: "No flux services found",
    hint: "Search for WMS/WMTS endpoints by country or provider name.",
  },
  opendata: {
    title: "No open data found",
    hint: "Try searching by dataset name or country.",
  },
}

function EmptyState({ domain }: { domain: CatalogDomain }) {
  const msg = EMPTY_MESSAGES[domain]
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center gap-1">
      <p className="text-xs font-medium text-muted-foreground">{msg.title}</p>
      <p className="text-label text-muted-foreground/60">{msg.hint}</p>
    </div>
  )
}
