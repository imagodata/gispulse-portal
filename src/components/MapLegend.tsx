import { useState } from "react"
import { ChevronDown, ChevronRight, Circle, Square, Minus, Shapes, Eye, EyeOff } from "lucide-react"
import { useMapViewStore, useActiveLayerStack, parseLayerKey } from "@/stores/mapViewStore"
import { useDatasetStore } from "@/stores/datasetStore"
import { useMapStore } from "@/stores/mapStore"

function GeomIcon({ type, color }: { type: string | null; color: string }) {
  const size = 10
  const style = { color }
  const t = type?.toLowerCase() ?? ""
  if (t.includes("polygon")) return <Square size={size} style={style} />
  if (t.includes("line")) return <Minus size={size} style={style} />
  if (t.includes("collection")) return <Shapes size={size} style={style} />
  return <Circle size={size} style={style} />
}

export function MapLegend() {
  const [collapsed, setCollapsed] = useState(false)
  const datasets = useDatasetStore((s) => s.datasets)
  const layerStack = useActiveLayerStack()
  const setLayerVisible = useMapViewStore((s) => s.setLayerVisible)
  const zoomToExtent = useMapStore((s) => s.zoomToExtent)

  // Collect all layers from active view for interactive legend
  const allLayers: { key: string; name: string; color: string; geomType: string | null; visible: boolean; opacity: number; bbox: [number, number, number, number] | null }[] = []
  for (const layer of layerStack) {
    const { datasetId, layerName } = parseLayerKey(layer.key)
    const ds = datasets.find((d) => d.id === datasetId)
    const meta = ds?.layers?.find((l) => l.name === layerName)
    allLayers.push({
      key: layer.key,
      name: layer.displayName || layerName,
      color: layer.color,
      geomType: meta?.geometry_type ?? null,
      visible: layer.visible,
      opacity: layer.opacity,
      bbox: meta?.bbox ?? null,
    })
  }

  if (allLayers.length === 0) return null
  const visibleCount = allLayers.filter((l) => l.visible).length

  return (
    <div className="rounded-md border bg-background/90 shadow-sm backdrop-blur-sm text-xs overflow-hidden max-w-[200px]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 hover:bg-accent transition-colors"
        aria-expanded={!collapsed}
        aria-controls="map-legend-list"
        aria-label={collapsed ? "Expand legend" : "Collapse legend"}
      >
        {collapsed ? <ChevronRight size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
        <span className="font-medium">Legend</span>
        <span className="text-muted-foreground ml-auto" aria-label={`${visibleCount} of ${allLayers.length} layers visible`}>
          {visibleCount}/{allLayers.length}
        </span>
      </button>
      {!collapsed && (
        <div className="px-2.5 pb-2 space-y-0.5" role="list" aria-label="Map layers">
          {allLayers.map((l) => (
            <button
              key={l.key}
              role="listitem"
              type="button"
              className={`group flex w-full items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent/50 transition-colors text-left ${
                !l.visible ? "opacity-40" : ""
              }`}
              onClick={() => setLayerVisible(l.key, !l.visible)}
              onDoubleClick={() => l.bbox && zoomToExtent(l.bbox)}
              aria-pressed={l.visible}
              aria-label={`${l.name} — ${l.visible ? "visible" : "hidden"}. Press to toggle. Double-click to zoom.`}
              title={`${l.name}\nClick: toggle visibility\nDouble-click: zoom to extent`}
            >
              <span className="shrink-0 h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.color, opacity: l.opacity }} aria-hidden="true" />
              <GeomIcon type={l.geomType} color={l.color} />
              <span className="truncate text-label-lg flex-1">{l.name}</span>
              <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true">
                {l.visible ? <Eye size={10} className="text-primary" /> : <EyeOff size={10} className="text-muted-foreground" />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
