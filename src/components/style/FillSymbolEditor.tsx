/**
 * FillSymbolEditor — Edit polygon fill properties: fill color, opacity, stroke color/width.
 */

import type { FillSymbol } from "@/types/layerStyle"
import { ColorInput, SliderInput, StyleSection } from "./shared"

const DASH_PRESETS: { label: string; value: number[] | undefined }[] = [
  { label: "Solid", value: undefined },
  { label: "Dash", value: [8, 4] },
  { label: "Dot", value: [2, 4] },
]

interface Props {
  symbol: FillSymbol
  onChange: (sym: FillSymbol) => void
}

export function FillSymbolEditor({ symbol, onChange }: Props) {
  const patch = (p: Partial<FillSymbol>) => onChange({ ...symbol, ...p })

  const currentDashIdx = DASH_PRESETS.findIndex((d) =>
    JSON.stringify(d.value) === JSON.stringify(symbol.strokeDashPattern),
  )

  return (
    <StyleSection title="Fill Symbol">
      <ColorInput label="Fill" value={symbol.color} onChange={(c) => patch({ color: c })} />
      <SliderInput label="Opacity" value={symbol.opacity} min={0} max={1} step={0.05} onChange={(v) => patch({ opacity: v })} />
      <ColorInput label="Stroke" value={symbol.strokeColor} onChange={(c) => patch({ strokeColor: c })} />
      <SliderInput label="Str. W" value={symbol.strokeWidth} min={0} max={8} step={0.5} unit="px" onChange={(v) => patch({ strokeWidth: v })} />
      <div className="flex items-center gap-1.5">
        <span className="text-label text-muted-foreground w-14 shrink-0">Border</span>
        <div className="flex gap-1 flex-1">
          {DASH_PRESETS.map((preset, i) => (
            <button
              key={preset.label}
              onClick={() => patch({ strokeDashPattern: preset.value })}
              className={`flex-1 h-6 rounded border text-label transition-colors ${
                i === currentDashIdx || (currentDashIdx === -1 && i === 0)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input hover:bg-accent text-muted-foreground"
              }`}
              title={preset.label}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </StyleSection>
  )
}
