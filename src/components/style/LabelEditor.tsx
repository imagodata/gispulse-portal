/**
 * LabelEditor — Configure text labels on map features.
 *
 * Field selector, font size, color, weight, halo (buffer), placement.
 * Generates MapLibre "symbol" layer via styleConverter.
 */

import type { LabelDef } from "@/types/layerStyle"
import type { LayerField } from "@/types/dataset"
import { ColorInput, SliderInput, SelectInput, StyleSection } from "./shared"

const PLACEMENTS: { value: NonNullable<LabelDef["placement"]>; label: string }[] = [
  { value: "point", label: "Point (center)" },
  { value: "line", label: "Along line" },
]

const WEIGHTS: { value: NonNullable<LabelDef["fontWeight"]>; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "bold", label: "Bold" },
]

interface Props {
  label: LabelDef
  fields: LayerField[]
  onChange: (label: LabelDef) => void
}

export function LabelEditor({ label, fields, onChange }: Props) {
  const patch = (p: Partial<LabelDef>) => onChange({ ...label, ...p })

  return (
    <StyleSection title="Labels">
      {/* Enable toggle */}
      <div className="flex items-center gap-1.5">
        <span className="text-label text-muted-foreground w-14 shrink-0">Show</span>
        <button
          onClick={() => patch({ enabled: !label.enabled })}
          className={`h-5 w-9 rounded-full transition-colors relative ${
            label.enabled ? "bg-primary" : "bg-muted"
          }`}
          role="switch"
          aria-checked={label.enabled}
          aria-label="Toggle labels"
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              label.enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {label.enabled && (
        <>
          <SelectInput
            label="Field"
            value={label.field || ""}
            options={[
              { value: "", label: "Select field..." },
              ...fields.map((f) => ({ value: f.name, label: f.name })),
            ]}
            onChange={(v) => patch({ field: v })}
          />

          <SliderInput
            label="Size"
            value={label.fontSize}
            min={6}
            max={32}
            step={1}
            unit="px"
            onChange={(v) => patch({ fontSize: v })}
          />

          <ColorInput label="Color" value={label.color} onChange={(c) => patch({ color: c })} />

          <SelectInput
            label="Weight"
            value={label.fontWeight ?? "normal"}
            options={WEIGHTS}
            onChange={(v) => patch({ fontWeight: v })}
          />

          <SelectInput
            label="Place"
            value={label.placement ?? "point"}
            options={PLACEMENTS}
            onChange={(v) => patch({ placement: v })}
          />

          {/* Halo / buffer */}
          <ColorInput
            label="Halo"
            value={label.haloColor ?? "#ffffff"}
            onChange={(c) => patch({ haloColor: c })}
          />
          <SliderInput
            label="H. Size"
            value={label.haloWidth ?? 1}
            min={0}
            max={4}
            step={0.5}
            unit="px"
            onChange={(v) => patch({ haloWidth: v })}
          />

          {/* Offset */}
          <div className="flex items-center gap-1.5">
            <span className="text-label text-muted-foreground w-14 shrink-0">Offset</span>
            <input
              type="number"
              value={label.offset?.[0] ?? 0}
              onChange={(e) => patch({ offset: [Number(e.target.value), label.offset?.[1] ?? 0] })}
              className="w-12 h-6 rounded border border-input bg-background px-1 text-xs text-center"
              step={0.5}
              title="X offset"
            />
            <input
              type="number"
              value={label.offset?.[1] ?? 0}
              onChange={(e) => patch({ offset: [label.offset?.[0] ?? 0, Number(e.target.value)] })}
              className="w-12 h-6 rounded border border-input bg-background px-1 text-xs text-center"
              step={0.5}
              title="Y offset"
            />
          </div>
        </>
      )}
    </StyleSection>
  )
}
