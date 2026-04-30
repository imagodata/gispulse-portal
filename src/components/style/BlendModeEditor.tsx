/**
 * BlendModeEditor — Composite operation selector.
 *
 * Lets the user pick one of the 12 standard CSS / QGIS blend modes that
 * apply when the layer is rendered. The selected value persists in the
 * `LayerStyleDef.blendMode` field and roundtrips through QML so QGIS
 * displays the same composite when the style is loaded.
 *
 * Note on rendering: MapLibre GL JS does not expose per-layer blend modes
 * through the style spec. The MapView consumer applies the blend by
 * setting `mix-blend-mode` on the layer-specific canvas group, which is a
 * best-effort visual preview — the canonical persisted source of truth is
 * the LayerStyleDef itself (and the QML roundtrip).
 */

import { useT } from "@/i18n/useT"
import type { StringKey } from "@/i18n/strings"
import { BLEND_MODES, type BlendMode } from "@/types/layerStyle"
import { SelectInput, StyleSection } from "./shared"

const LABEL_KEYS: Record<BlendMode, StringKey> = {
  "normal":      "style.blend_mode.normal",
  "multiply":    "style.blend_mode.multiply",
  "screen":      "style.blend_mode.screen",
  "overlay":     "style.blend_mode.overlay",
  "darken":      "style.blend_mode.darken",
  "lighten":     "style.blend_mode.lighten",
  "color-dodge": "style.blend_mode.color_dodge",
  "color-burn":  "style.blend_mode.color_burn",
  "hard-light":  "style.blend_mode.hard_light",
  "soft-light":  "style.blend_mode.soft_light",
  "difference":  "style.blend_mode.difference",
  "exclusion":   "style.blend_mode.exclusion",
}

interface Props {
  blendMode: BlendMode | undefined
  onChange: (mode: BlendMode | undefined) => void
}

export function BlendModeEditor({ blendMode, onChange }: Props) {
  const t = useT()
  const current: BlendMode = blendMode ?? "normal"

  return (
    <StyleSection title={t("style.section.blend_mode")}>
      <SelectInput<BlendMode>
        label={t("style.method")}
        value={current}
        options={BLEND_MODES.map((m) => ({ value: m, label: t(LABEL_KEYS[m]) }))}
        onChange={(v) => onChange(v === "normal" ? undefined : v)}
      />
    </StyleSection>
  )
}
