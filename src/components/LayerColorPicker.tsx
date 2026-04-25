import { useState, useRef, useEffect } from "react"
import { HexColorPicker } from "react-colorful"

const PRESET_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
  "#84cc16", "#a855f7",
]

interface LayerColorPickerProps {
  color: string
  opacity: number
  onColorChange: (color: string) => void
  onOpacityChange: (opacity: number) => void
  strokeColor?: string
  strokeWidth?: number
  onStrokeColorChange?: (color: string) => void
  onStrokeWidthChange?: (width: number) => void
}

type StyleTab = "fill" | "stroke"

export function LayerColorPicker({
  color,
  opacity,
  onColorChange,
  onOpacityChange,
  strokeColor,
  strokeWidth,
  onStrokeColorChange,
  onStrokeWidthChange,
}: LayerColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<StyleTab>("fill")
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const hasStroke = onStrokeColorChange && onStrokeWidthChange
  const currentStrokeColor = strokeColor ?? "#000000"
  const currentStrokeWidth = strokeWidth ?? 1

  return (
    <div className="relative" ref={popoverRef}>
      {/* Swatch: shows fill color with stroke ring */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="shrink-0 h-3.5 w-3.5 rounded-full hover:ring-2 hover:ring-ring/30 transition-all"
        style={{
          backgroundColor: color,
          border: strokeColor ? `1.5px solid ${strokeColor}` : "1px solid var(--border)",
        }}
        aria-label="Change layer style"
      />
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 rounded-lg border bg-popover p-3 shadow-lg min-w-[210px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tabs: Fill / Stroke */}
          {hasStroke && (
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setTab("fill")}
                className={`flex-1 text-label font-medium py-1 rounded transition-colors ${
                  tab === "fill" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                Fill
              </button>
              <button
                onClick={() => setTab("stroke")}
                className={`flex-1 text-label font-medium py-1 rounded transition-colors ${
                  tab === "stroke" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                Stroke
              </button>
            </div>
          )}

          {/* Fill tab (default) */}
          {tab === "fill" && (
            <>
              <HexColorPicker color={color} onChange={onColorChange} style={{ width: 180, height: 120 }} />
              <div className="grid grid-cols-6 gap-1 mt-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => onColorChange(c)}
                    className={`h-5 w-5 rounded-full border transition-all ${
                      color === c ? "ring-2 ring-ring ring-offset-1" : "border-border hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="mt-3">
                <label className="text-label text-muted-foreground">Opacity: {Math.round(opacity * 100)}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(opacity * 100)}
                  onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
                  className="w-full h-1.5 mt-1 accent-primary"
                />
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-label text-muted-foreground">#</span>
                <input
                  type="text"
                  value={color.replace("#", "")}
                  onChange={(e) => {
                    const v = e.target.value.replace("#", "")
                    if (/^[0-9a-fA-F]{0,6}$/.test(v)) {
                      if (v.length === 6) onColorChange(`#${v}`)
                    }
                  }}
                  className="flex-1 text-xs font-mono bg-transparent border-b border-border outline-none px-0.5 py-0.5"
                  maxLength={6}
                />
              </div>
            </>
          )}

          {/* Stroke tab */}
          {tab === "stroke" && hasStroke && (
            <>
              <HexColorPicker color={currentStrokeColor} onChange={onStrokeColorChange} style={{ width: 180, height: 120 }} />
              <div className="grid grid-cols-6 gap-1 mt-2">
                {["#000000", "#ffffff", "#374151", "#6b7280", ...PRESET_COLORS.slice(0, 8)].map((c) => (
                  <button
                    key={c}
                    onClick={() => onStrokeColorChange(c)}
                    className={`h-5 w-5 rounded-full border transition-all ${
                      currentStrokeColor === c ? "ring-2 ring-ring ring-offset-1" : "border-border hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="mt-3">
                <label className="text-label text-muted-foreground">Width: {currentStrokeWidth}px</label>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={0.5}
                  value={currentStrokeWidth}
                  onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
                  className="w-full h-1.5 mt-1 accent-primary"
                />
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-label text-muted-foreground">#</span>
                <input
                  type="text"
                  value={currentStrokeColor.replace("#", "")}
                  onChange={(e) => {
                    const v = e.target.value.replace("#", "")
                    if (/^[0-9a-fA-F]{0,6}$/.test(v)) {
                      if (v.length === 6) onStrokeColorChange(`#${v}`)
                    }
                  }}
                  className="flex-1 text-xs font-mono bg-transparent border-b border-border outline-none px-0.5 py-0.5"
                  maxLength={6}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
