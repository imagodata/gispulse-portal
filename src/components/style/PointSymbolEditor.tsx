/**
 * PointSymbolEditor — Edit point symbol properties: shape, size, color, stroke, rotation.
 */

import type { PointSymbol, PointShape } from "@/types/layerStyle"
import { ColorInput, SliderInput, SelectInput, StyleSection } from "./shared"

const SHAPES: { value: PointShape; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
  { value: "triangle", label: "Triangle" },
  { value: "diamond", label: "Diamond" },
  { value: "cross", label: "Cross" },
  { value: "star", label: "Star" },
]

interface Props {
  symbol: PointSymbol
  onChange: (sym: PointSymbol) => void
}

export function PointSymbolEditor({ symbol, onChange }: Props) {
  const patch = (p: Partial<PointSymbol>) => onChange({ ...symbol, ...p })

  return (
    <StyleSection title="Point Symbol">
      <SelectInput label="Shape" value={symbol.shape} options={SHAPES} onChange={(v) => patch({ shape: v })} />
      <SliderInput label="Size" value={symbol.size} min={1} max={20} step={0.5} unit="px" onChange={(v) => patch({ size: v })} />
      <ColorInput label="Color" value={symbol.color} onChange={(c) => patch({ color: c })} />
      <SliderInput label="Opacity" value={symbol.opacity} min={0} max={1} step={0.05} onChange={(v) => patch({ opacity: v })} />
      <ColorInput label="Stroke" value={symbol.strokeColor} onChange={(c) => patch({ strokeColor: c })} />
      <SliderInput label="Str. W" value={symbol.strokeWidth} min={0} max={5} step={0.5} unit="px" onChange={(v) => patch({ strokeWidth: v })} />
      <SliderInput label="Rotate" value={symbol.rotation ?? 0} min={0} max={360} step={5} unit="deg" onChange={(v) => patch({ rotation: v || undefined })} />
    </StyleSection>
  )
}
