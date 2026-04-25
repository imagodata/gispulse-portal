/**
 * ScaleVisibility — Min/max zoom sliders for layer scale-dependent visibility.
 */

import { SliderInput, StyleSection } from "./shared"

interface Props {
  minZoom?: number
  maxZoom?: number
  onChange: (minZoom: number | undefined, maxZoom: number | undefined) => void
}

export function ScaleVisibility({ minZoom, maxZoom, onChange }: Props) {
  return (
    <StyleSection title="Scale Visibility">
      <SliderInput
        label="Min Z"
        value={minZoom ?? 0}
        min={0}
        max={22}
        step={1}
        onChange={(v) => onChange(v === 0 ? undefined : v, maxZoom)}
      />
      <SliderInput
        label="Max Z"
        value={maxZoom ?? 22}
        min={0}
        max={22}
        step={1}
        onChange={(v) => onChange(minZoom, v === 22 ? undefined : v)}
      />
      <div className="text-label-sm text-muted-foreground">
        {minZoom == null && maxZoom == null
          ? "Visible at all zoom levels"
          : `Visible from zoom ${minZoom ?? 0} to ${maxZoom ?? 22}`}
      </div>
    </StyleSection>
  )
}
