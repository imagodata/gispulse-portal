import { useState, useEffect } from "react"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import { IconButton } from "@/components/ui/icon-button"
import { useMapViewStore, useActiveBasemap } from "@/stores/mapViewStore"
import { BASEMAPS } from "@/types/project"
import { getCachedBasemaps } from "@/api/client"

interface BasemapOption {
  id: string
  name: string
  url: string | null
  category: "base" | "satellite" | "terrain" | "custom"
}

/** Build a thumbnail URL by substituting a fixed tile (z=5, x=16, y=11 ≈ France). */
function getThumbnailUrl(urlTemplate: string | null): string | null {
  if (!urlTemplate) return null
  return urlTemplate
    .replace("{z}", "5")
    .replace("{x}", "16")
    .replace("{y}", "11")
}

function BasemapCard({ bm, isSelected, onSelect }: { bm: BasemapOption; isSelected: boolean; onSelect: () => void }) {
  const [imgError, setImgError] = useState(false)
  const thumbUrl = getThumbnailUrl(bm.url)

  return (
    <button
      onClick={onSelect}
      className={`flex flex-col items-center gap-1 rounded-lg border-2 p-1.5 transition-all hover:border-primary/50 ${
        isSelected ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent"
      }`}
    >
      <div className="relative w-16 h-10 rounded-md border border-border/50 overflow-hidden bg-muted">
        {thumbUrl && !imgError ? (
          <img
            src={thumbUrl}
            alt={bm.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-label-sm">
            {bm.id === "none" ? "—" : "?"}
          </div>
        )}
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-label">&#10003;</div>
          </div>
        )}
      </div>
      <span className="text-label text-center truncate w-full">{bm.name}</span>
    </button>
  )
}

export function BasemapSwitcher() {
  const basemap = useActiveBasemap()
  const setBasemap = useMapViewStore((s) => s.setBasemap)
  const [open, setOpen] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customUrl, setCustomUrl] = useState("")
  const [customBasemaps, setCustomBasemaps] = useState<BasemapOption[]>(() => {
    try {
      const raw = localStorage.getItem("gispulse:customBasemaps")
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  const [options, setOptions] = useState<BasemapOption[]>(
    BASEMAPS.map((b) => ({
      id: b.id,
      name: b.name,
      url: b.url,
      category: b.id === "satellite" ? "satellite" : b.id === "topo" ? "terrain" : "base",
    })),
  )

  useEffect(() => {
    getCachedBasemaps()
      .then((entries) => {
        const catalog: BasemapOption[] = entries.map((e) => {
          const id = e.id.replace("basemap:", "")
          const tags = e.tags ?? []
          const cat = tags.includes("satellite") || tags.includes("ortho") || tags.includes("imagery")
            ? "satellite" as const
            : tags.includes("topo") || tags.includes("elevation")
            ? "terrain" as const
            : "base" as const
          return { id, name: e.name, url: e.url_template || null, category: cat }
        })
        if (catalog.length > 0) setOptions(catalog)
      })
      .catch(() => {})
  }, [])

  const allOptions = [...options, ...customBasemaps]
  const current = allOptions.find((b) => b.id === basemap) ?? options[0]

  const handleAddCustom = () => {
    if (!customName.trim() || !customUrl.trim()) {
      toast.error("Name and URL are required")
      return
    }
    if (!customUrl.includes("{z}") || !customUrl.includes("{x}") || !customUrl.includes("{y}")) {
      toast.error("URL must contain {z}, {x}, {y} placeholders")
      return
    }
    const newBm: BasemapOption = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      url: customUrl.trim(),
      category: "custom",
    }
    const updated = [...customBasemaps, newBm]
    setCustomBasemaps(updated)
    localStorage.setItem("gispulse:customBasemaps", JSON.stringify(updated))
    setBasemap(newBm.id)
    setCustomName("")
    setCustomUrl("")
    setShowCustomForm(false)
    toast.success(`Basemap "${newBm.name}" added`)
  }

  const handleRemoveCustom = (id: string) => {
    const updated = customBasemaps.filter(b => b.id !== id)
    setCustomBasemaps(updated)
    localStorage.setItem("gispulse:customBasemaps", JSON.stringify(updated))
    if (basemap === id) setBasemap("osm")
  }

  // Group by category
  const grouped = new Map<string, BasemapOption[]>()
  for (const bm of allOptions) {
    const cat = bm.category
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(bm)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border bg-background/90 px-2 py-1.5 text-xs shadow-sm backdrop-blur-sm hover:bg-accent transition-colors"
        title="Change basemap"
      >
        <span className="text-muted-foreground">Map:</span>
        <span className="font-medium">{current?.name ?? basemap}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-[240px] rounded-lg border bg-background/95 shadow-lg backdrop-blur-sm p-3 z-50">
          <div className="text-label font-semibold uppercase tracking-wider text-muted-foreground mb-2">Map Style</div>

          {Array.from(grouped.entries()).map(([category, bms]) => (
            <div key={category} className="mb-2">
              <div className="text-label-sm font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                {category}
              </div>
              <div className="grid grid-cols-3 gap-1">
                {bms.map((bm) => (
                  <div key={bm.id} className="relative group">
                    <BasemapCard
                      bm={bm}
                      isSelected={basemap === bm.id}
                      onSelect={() => { setBasemap(bm.id); setOpen(false) }}
                    />
                    {bm.category === "custom" && (
                      <IconButton
                        label="Remove custom basemap"
                        variant="destructive"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleRemoveCustom(bm.id) }}
                        className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-background rounded-full shadow"
                      >
                        <X size={10} />
                      </IconButton>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Add custom basemap */}
          {!showCustomForm ? (
            <button
              onClick={() => setShowCustomForm(true)}
              className="flex items-center gap-1.5 w-full rounded-md border border-dashed border-muted-foreground/25 px-2 py-1.5 text-label text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors mt-1"
            >
              <Plus size={12} /> Add custom basemap
            </button>
          ) : (
            <div className="mt-2 space-y-1.5 border-t pt-2">
              <input
                type="text"
                placeholder="Name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full text-xs rounded border px-2 py-1 bg-background outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                type="text"
                placeholder="https://tiles.example.com/{z}/{x}/{y}.png"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="w-full text-xs rounded border px-2 py-1 bg-background outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <div className="flex gap-1">
                <button onClick={handleAddCustom} className="flex-1 text-label bg-primary text-primary-foreground rounded px-2 py-1 hover:bg-primary/90">
                  Add
                </button>
                <button onClick={() => setShowCustomForm(false)} className="flex-1 text-label border rounded px-2 py-1 hover:bg-accent">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Exported for MapView -- resolve basemap URL from ID */
export function getBasemapUrl(id: string): string | null {
  // Check static basemaps
  const bm = BASEMAPS.find((b) => b.id === id)
  if (bm) return bm.url
  // Check custom basemaps from localStorage
  try {
    const raw = localStorage.getItem("gispulse:customBasemaps")
    const customs = raw ? JSON.parse(raw) : []
    const custom = customs.find((c: BasemapOption) => c.id === id)
    return custom?.url ?? null
  } catch {
    return null
  }
}
