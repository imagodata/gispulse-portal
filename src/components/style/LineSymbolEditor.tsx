/**
 * LineSymbolEditor — Edit line symbol properties: color, width, dash, cap, join.
 */

import type { LineSymbol } from "@/types/layerStyle"
import { ColorInput, SliderInput, SelectInput, StyleSection } from "./shared"

const CAPS: { value: NonNullable<LineSymbol["cap"]>; label: string }[] = [
  { value: "round", label: "Round" },
  { value: "butt", label: "Butt" },
  { value: "square", label: "Square" },
]

const JOINS: { value: NonNullable<LineSymbol["join"]>; label: string }[] = [
  { value: "round", label: "Round" },
  { value: "miter", label: "Miter" },
  { value: "bevel", label: "Bevel" },
]

const DASH_PRESETS: { label: string; value: number[] | undefined }[] = [
  { label: "Solid", value: undefined },
  { label: "Dash", value: [8, 4] },
  { label: "Dot", value: [2, 4] },
  { label: "Dash-Dot", value: [8, 4, 2, 4] },
  { label: "Long Dash", value: [12, 6] },
]

interface Props {
  symbol: LineSymbol
  onChange: (sym: LineSymbol) => void
}

export function LineSymbolEditor({ symbol, onChange }: Props) {
  const patch = (p: Partial<LineSymbol>) => onChange({ ...symbol, ...p })

  const currentDashIdx = DASH_PRESETS.findIndex((d) =>
    JSON.stringify(d.value) === JSON.stringify(symbol.dashPattern),
  )

  return (
    <StyleSection title="Line Symbol">
      <ColorInput label="Color" value={symbol.color} onChange={(c) => patch({ color: c })} />
      <SliderInput label="Width" value={symbol.width} min={0.5} max={12} step={0.5} unit="px" onChange={(v) => patch({ width: v })} />
      <SliderInput label="Opacity" value={symbol.opacity} min={0} max={1} step={0.05} onChange={(v) => patch({ opacity: v })} />
      <div className="flex items-center gap-1.5">
        <span className="text-label text-muted-foreground w-14 shrink-0">Dash</span>
        <div className="flex gap-1 flex-1">
          {DASH_PRESETS.map((preset, i) => (
            <button
              key={preset.label}
              onClick={() => patch({ dashPattern: preset.value })}
              className={`flex-1 h-6 rounded border text-label transition-colors ${
                i === currentDashIdx || (currentDashIdx === -1 && i === 0)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input hover:bg-accent text-muted-foreground"
              }`}
              title={preset.label}
            >
              {preset.label.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
      <SelectInput label="Cap" value={symbol.cap ?? "round"} options={CAPS} onChange={(v) => patch({ cap: v })} />
      <SelectInput label="Join" value={symbol.join ?? "round"} options={JOINS} onChange={(v) => patch({ join: v })} />
    </StyleSection>
  )
}
