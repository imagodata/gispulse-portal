/**
 * ScaleVisibility — Min/max zoom range + zoom-to-layer-extent action.
 *
 * Two coupled sliders set `minZoom`/`maxZoom` on the LayerStyleDef.
 * MapLibre interprets these as the layer's `minzoom`/`maxzoom` in the
 * style spec (see styleConverter.ts).
 *
 * The "Zoom to layer extent" button delegates to `useMapStore.zoomToExtent`
 * with the layer's bbox; it is disabled when the bbox is unavailable
 * or degenerate (zero-area).
 */

import { Crosshair } from "lucide-react"
import { useT } from "@/i18n/useT"
import { useMapStore } from "@/stores/mapStore"
import { SliderInput, StyleSection } from "./shared"

interface Props {
  minZoom?: number
  maxZoom?: number
  bbox?: [number, number, number, number]
  onChange: (minZoom: number | undefined, maxZoom: number | undefined) => void
}

export function ScaleVisibility({ minZoom, maxZoom, bbox, onChange }: Props) {
  const t = useT()
  const zoomToExtent = useMapStore((s) => s.zoomToExtent)

  const lo = minZoom ?? 0
  const hi = maxZoom ?? 22

  const validBbox = (() => {
    if (!bbox) return false
    const [minx, miny, maxx, maxy] = bbox
    if (![minx, miny, maxx, maxy].every(Number.isFinite)) return false
    if (minx === 0 && miny === 0 && maxx === 0 && maxy === 0) return false
    return true
  })()

  const summary =
    minZoom == null && maxZoom == null
      ? t("style.scale.always_visible")
      : t("style.scale.range")
          .replace("{min}", String(lo))
          .replace("{max}", String(hi))

  // Coupled sliders: ensure min < max so the layer never disappears
  const handleMin = (v: number) => {
    const next = Math.min(v, hi)
    onChange(next === 0 ? undefined : next, maxZoom)
  }
  const handleMax = (v: number) => {
    const next = Math.max(v, lo)
    onChange(minZoom, next === 22 ? undefined : next)
  }

  return (
    <StyleSection title={t("style.section.scale_visibility")}>
      <SliderInput
        label={t("style.scale.min_zoom")}
        value={lo}
        min={0}
        max={22}
        step={1}
        onChange={handleMin}
      />
      <SliderInput
        label={t("style.scale.max_zoom")}
        value={hi}
        min={0}
        max={22}
        step={1}
        onChange={handleMax}
      />
      <div className="text-label-sm text-muted-foreground" aria-live="polite">
        {summary}
      </div>
      <button
        type="button"
        onClick={() => { if (validBbox && bbox) zoomToExtent(bbox) }}
        disabled={!validBbox}
        aria-label={t("style.scale.zoom_to_layer")}
        className="flex items-center justify-center gap-1.5 w-full h-7 rounded border border-input bg-background text-xs font-medium hover:bg-accent disabled:opacity-40 transition-colors"
      >
        <Crosshair size={12} />
        {t("style.scale.zoom_to_layer")}
      </button>
    </StyleSection>
  )
}
