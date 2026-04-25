import { useState } from "react"
import { Bookmark, Plus, X } from "lucide-react"
import { IconButton } from "@/components/ui/icon-button"
import { useUIStore, type MapBookmark } from "@/stores/uiStore"
import type maplibregl from "maplibre-gl"

interface MapBookmarksProps {
  mapRef: React.RefObject<maplibregl.Map | null>
  ready: boolean
}

export function MapBookmarks({ mapRef, ready: _ready }: MapBookmarksProps) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const { bookmarks, addBookmark, removeBookmark } = useUIStore()

  const handleSave = () => {
    if (!mapRef.current || !newName.trim()) return
    const map = mapRef.current
    const center = map.getCenter()
    addBookmark({
      name: newName.trim(),
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    })
    setNewName("")
  }

  const handleGoto = (bm: MapBookmark) => {
    if (!mapRef.current) return
    mapRef.current.flyTo({
      center: bm.center,
      zoom: bm.zoom,
      bearing: bm.bearing,
      pitch: bm.pitch,
      duration: 1500,
    })
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-center h-7 w-7 rounded-md border shadow-sm backdrop-blur-sm transition-colors ${
          open ? "bg-primary text-primary-foreground" : "bg-background/90 text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        title="Bookmarks"
        aria-label="Map bookmarks"
      >
        <Bookmark size={14} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 rounded-lg border bg-background/95 shadow-lg backdrop-blur-sm p-2 z-50">
          {/* Save current view */}
          <div className="flex gap-1 mb-2">
            <input
              type="text"
              placeholder="Bookmark name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="flex-1 text-xs rounded border px-2 py-1 bg-background outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleSave}
              disabled={!newName.trim()}
              className="shrink-0 text-label bg-primary text-primary-foreground rounded px-2 py-1 hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus size={12} />
            </button>
          </div>

          {bookmarks.length > 0 ? (
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-xs cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleGoto(bm)}
                >
                  <Bookmark size={10} className="shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{bm.name}</span>
                  <IconButton
                    label="Remove bookmark"
                    variant="destructive"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); removeBookmark(bm.id) }}
                    className="opacity-0 group-hover:opacity-100"
                  >
                    <X size={10} />
                  </IconButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-label text-muted-foreground text-center py-2">No bookmarks yet</p>
          )}
        </div>
      )}
    </div>
  )
}
