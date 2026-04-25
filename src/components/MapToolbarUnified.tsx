/**
 * MapToolbarUnified — Issue #138 (Sprint R-5)
 *
 * Toolbar unifiee avec groupes fonctionnels :
 *   Navigation | Selection | Draw | Measure | Basemap | Bookmarks
 *
 * Keyboard shortcuts: D=draw, M=measure, Esc=pan
 * Active state visual feedback, tooltips via title attr.
 */

import { useEffect } from "react"
import { navigateToView } from "@/router"
import {
  MousePointer2,
  RulerIcon,
  SquareDashedIcon,
  PenToolIcon,
  CircleDotIcon,
  MinusIcon,
  PentagonIcon,
  Trash2Icon,
  CheckIcon,
  XIcon,
  Layers,
  MapIcon,
  FilterIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/stores/uiStore"
import { useFilterStore } from "@/stores/filterStore"
import type { MeasureMode } from "@/hooks/useMeasure"
import type { DrawMode } from "@/hooks/useDraw"
import { BasemapSwitcher } from "./BasemapSwitcher"

// ---------------------------------------------------------------------------
// Tool button
// ---------------------------------------------------------------------------

interface ToolBtnProps {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  shortcut?: string
  children: React.ReactNode
  className?: string
}

function ToolBtn({ active, disabled, onClick, title, shortcut, children, className }: ToolBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${title} [${shortcut}]` : title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "flex h-7 min-w-[28px] items-center justify-center gap-1 rounded px-1.5 text-xs transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:pointer-events-none disabled:opacity-40",
        active && "bg-primary text-primary-foreground hover:bg-primary/90",
        className,
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-border" aria-hidden />
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MapToolbarUnifiedProps {
  // Measure
  measureMode: MeasureMode
  measureResult: string
  measurePointCount: number
  onMeasureMode: (mode: MeasureMode) => void
  onMeasureClear: () => void

  // Draw
  drawMode: DrawMode
  drawActiveLayer: string | null
  drawAvailableLayers: string[]
  drawPointCount: number
  onDrawMode: (mode: DrawMode) => void
  onDrawActiveLayer: (name: string) => void
  onDrawFinish: () => void
  onDrawClear: () => void

}

export function MapToolbarUnified({
  measureMode,
  measureResult,
  measurePointCount,
  onMeasureMode,
  onMeasureClear,
  drawMode,
  drawActiveLayer,
  drawAvailableLayers,
  drawPointCount,
  onDrawMode,
  onDrawActiveLayer,
  onDrawFinish,
  onDrawClear,
}: MapToolbarUnifiedProps) {
  const { setBottomTab } = useUIStore()
  const filterOpen = useFilterStore((s) => s.open)
  const toggleFilter = useFilterStore((s) => s.toggle)

  // ---- Keyboard shortcuts -------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in an input / textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return

      if (e.key === "Escape") {
        onMeasureMode("none")
        onDrawMode("none")
      } else if (e.key.toLowerCase() === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        toggleFilter()
      } else if (e.key.toLowerCase() === "m" && !e.ctrlKey && !e.metaKey) {
        onMeasureMode(measureMode === "distance" ? "none" : "distance")
      } else if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.metaKey) {
        onDrawMode(drawMode === "point" ? "none" : "point")
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [measureMode, drawMode, onMeasureMode, onDrawMode, toggleFilter])

  const drawModes: { key: DrawMode; label: string; icon: React.ReactNode; shortcut?: string }[] = [
    { key: "point", label: "Point", icon: <CircleDotIcon className="h-3.5 w-3.5" />, shortcut: "D" },
    { key: "line", label: "Line", icon: <MinusIcon className="h-3.5 w-3.5" /> },
    { key: "polygon", label: "Polygon", icon: <PentagonIcon className="h-3.5 w-3.5" /> },
    { key: "delete", label: "Delete feature", icon: <Trash2Icon className="h-3.5 w-3.5" /> },
  ]

  return (
    <div
      className="flex items-center gap-0.5 rounded-md border bg-background/95 px-2 py-1 shadow-md backdrop-blur-sm"
      role="toolbar"
      aria-label="Map tools"
    >
      {/* --- Navigation group --- */}
      <ToolBtn
        active={measureMode === "none" && drawMode === "none"}
        onClick={() => { onMeasureMode("none"); onDrawMode("none") }}
        title="Pan / Select"
        shortcut="Esc"
      >
        <MousePointer2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Pan</span>
      </ToolBtn>

      <Divider />

      {/* --- Measure group --- */}
      <ToolBtn
        active={measureMode === "distance"}
        onClick={() => onMeasureMode(measureMode === "distance" ? "none" : "distance")}
        title="Measure distance"
        shortcut="M"
      >
        <RulerIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Dist</span>
      </ToolBtn>

      <ToolBtn
        active={measureMode === "area"}
        onClick={() => onMeasureMode(measureMode === "area" ? "none" : "area")}
        title="Measure area"
      >
        <SquareDashedIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Area</span>
      </ToolBtn>

      {measurePointCount > 0 && (
        <ToolBtn onClick={onMeasureClear} title="Clear measurement">
          <XIcon className="h-3.5 w-3.5" />
        </ToolBtn>
      )}

      {measureResult && (
        <span className="ml-1 rounded bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-foreground">
          {measureResult}
        </span>
      )}

      {measureMode !== "none" && !measureResult && (
        <span className="ml-1 text-label text-muted-foreground">Click map…</span>
      )}

      <Divider />

      {/* --- Draw group --- */}
      <PenToolIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />

      {drawAvailableLayers.length > 0 && (
        <select
          value={drawActiveLayer || ""}
          onChange={(e) => onDrawActiveLayer(e.target.value)}
          className="h-6 max-w-[90px] rounded border border-input bg-background px-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Target layer for drawing"
        >
          <option value="" disabled>Layer…</option>
          {drawAvailableLayers.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      )}

      {drawModes.map(({ key, label, icon, shortcut }) => (
        <ToolBtn
          key={key}
          active={drawMode === key}
          disabled={!drawActiveLayer}
          onClick={() => onDrawMode(drawMode === key ? "none" : key)}
          title={label}
          shortcut={shortcut}
        >
          {icon}
        </ToolBtn>
      ))}

      {drawMode !== "none" && drawMode !== "point" && drawMode !== "delete" && drawPointCount > 0 && (
        <>
          <ToolBtn onClick={onDrawFinish} title="Complete shape">
            <CheckIcon className="h-3.5 w-3.5" />
            <span className="text-label">{drawPointCount}pts</span>
          </ToolBtn>
          <ToolBtn onClick={onDrawClear} title="Discard draw">
            <XIcon className="h-3.5 w-3.5" />
          </ToolBtn>
        </>
      )}

      <Divider />

      {/* --- View shortcuts --- */}
      <ToolBtn onClick={() => navigateToView("schema")} title="Open Schema view">
        <Layers className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Schema</span>
      </ToolBtn>

      <ToolBtn onClick={() => setBottomTab("sql")} title="Open SQL Console">
        <MapIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">SQL</span>
      </ToolBtn>

      {/* --- Filter panel toggle --- */}
      <ToolBtn
        active={filterOpen}
        onClick={toggleFilter}
        title="Filter Panel"
        shortcut="Ctrl+F"
      >
        <FilterIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Filter</span>
      </ToolBtn>

      <Divider />

      {/* --- Basemap inline switcher --- */}
      <BasemapSwitcher />
    </div>
  )
}
