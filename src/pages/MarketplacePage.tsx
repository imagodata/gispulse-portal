/**
 * pages/MarketplacePage.tsx — Plugin marketplace.
 *
 * Accessible to all authenticated users (not admin-only).
 * Two tabs: Installed (list) and Browse (grid of plugin cards).
 * Search bar filters both tabs client-side.
 *
 * Route: /marketplace (in WorkspaceLayout, protected by AuthGuard)
 */

import { useEffect, useState, useMemo } from "react"
import { Package, Search, RefreshCw } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PluginCard } from "@/components/marketplace/PluginCard"
import {
  listInstalled,
  searchPlugins,
  type Plugin,
  type InstalledPlugin,
  type PluginCategory,
} from "@/api/marketplace"

type OnInstalledCallback = (pluginId: string) => void

// ---------------------------------------------------------------------------
// Category filter pills
// ---------------------------------------------------------------------------

const CATEGORIES: { value: PluginCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "analysis", label: "Analysis" },
  { value: "import", label: "Import" },
  { value: "export", label: "Export" },
  { value: "geometry", label: "Geometry" },
  { value: "visualization", label: "Visualization" },
  { value: "integration", label: "Integration" },
  { value: "utilities", label: "Utilities" },
]

function CategoryPills({
  selected,
  onChange,
}: {
  selected: PluginCategory | "all"
  onChange: (cat: PluginCategory | "all") => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            selected === cat.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          aria-pressed={selected === cat.value}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Installed tab
// ---------------------------------------------------------------------------

function InstalledTab({
  plugins,
  loading,
  search,
  onUninstalled,
}: {
  plugins: InstalledPlugin[]
  loading: boolean
  search: string
  onUninstalled: (id: string) => void
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return plugins
    const q = search.toLowerCase()
    return plugins.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q))
    )
  }, [plugins, search])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl border border-border bg-muted/30 animate-pulse" />
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Package size={28} strokeWidth={1.5} />
        <p className="text-sm font-medium">
          {search ? "No installed plugins match your search" : "No plugins installed yet"}
        </p>
        <p className="text-xs">
          {search ? "Try a different search term" : "Browse the catalog to discover plugins"}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((plugin) => (
        <PluginCard
          key={plugin.id}
          plugin={plugin}
          installed
          onUninstalled={onUninstalled}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Browse tab
// ---------------------------------------------------------------------------

function BrowseTab({
  plugins,
  installedIds,
  loading,
  search,
  category,
  onInstalled,
}: {
  plugins: Plugin[]
  installedIds: Set<string>
  loading: boolean
  search: string
  category: PluginCategory | "all"
  onInstalled: OnInstalledCallback
}) {
  const filtered = useMemo(() => {
    return plugins.filter((p) => {
      const matchQ =
        !search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.author.toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      const matchCat = category === "all" || p.category === category
      return matchQ && matchCat
    })
  }, [plugins, search, category])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl border border-border bg-muted/30 animate-pulse" />
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Search size={28} strokeWidth={1.5} />
        <p className="text-sm font-medium">No plugins found</p>
        <p className="text-xs">Try a different search term or category</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((plugin) => (
        <PluginCard
          key={plugin.id}
          plugin={plugin}
          installed={installedIds.has(plugin.id)}
          onInstalled={onInstalled}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MarketplacePage
// ---------------------------------------------------------------------------

export function MarketplacePage() {
  const [installed, setInstalled] = useState<InstalledPlugin[]>([])
  const [catalog, setCatalog] = useState<Plugin[]>([])
  const [installedLoading, setInstalledLoading] = useState(true)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<PluginCategory | "all">("all")
  const [activeTab, setActiveTab] = useState("browse")

  const installedIds = useMemo(() => new Set(installed.map((p) => p.id)), [installed])

  async function fetchInstalled() {
    setInstalledLoading(true)
    try {
      const data = await listInstalled()
      setInstalled(data)
    } catch {
      setInstalled([])
    } finally {
      setInstalledLoading(false)
    }
  }

  async function fetchCatalog() {
    setCatalogLoading(true)
    try {
      const data = await searchPlugins()
      setCatalog(data)
    } catch {
      setCatalog([])
    } finally {
      setCatalogLoading(false)
    }
  }

  useEffect(() => {
    fetchInstalled()
    fetchCatalog()
  }, [])

  function handleInstalled(_pluginId: string) {
    // After install, refresh the installed list from the backend
    fetchInstalled()
  }

  function handleUninstalled(id: string) {
    setInstalled((prev) => prev.filter((p) => p.id !== id))
  }

  const isLoading = installedLoading || catalogLoading

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-semibold flex items-center gap-2">
              <Package size={16} className="text-primary" />
              Marketplace
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Discover and install plugins to extend GISPulse capabilities.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchInstalled(); fetchCatalog() }}
            disabled={isLoading}
          >
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>

        {/* Search bar */}
        <div className="relative max-w-sm">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plugins..."
            className="pl-8 h-8 text-xs"
            aria-label="Search plugins"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-2 flex items-center gap-4">
            <TabsList variant="line" className="h-8">
              <TabsTrigger value="browse">
                Browse
                <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground px-1.5 rounded-full">
                  {catalog.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="installed">
                Installed
                {installed.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 rounded-full">
                    {installed.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Category filter — only for Browse tab */}
            {activeTab === "browse" && (
              <div className="ml-auto">
                <CategoryPills selected={category} onChange={setCategory} />
              </div>
            )}
          </div>

          <TabsContent value="browse" className="p-6">
            <BrowseTab
              plugins={catalog}
              installedIds={installedIds}
              loading={catalogLoading}
              search={search}
              category={category}
              onInstalled={handleInstalled}
            />
          </TabsContent>

          <TabsContent value="installed" className="p-6">
            <InstalledTab
              plugins={installed}
              loading={installedLoading}
              search={search}
              onUninstalled={handleUninstalled}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
