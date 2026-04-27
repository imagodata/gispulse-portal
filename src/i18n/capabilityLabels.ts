import type { Locale } from "@/stores/localeStore"

type Bilingual = { en: string; fr: string }

const COMMON: Record<string, Bilingual> = {
  distance: { en: "Distance", fr: "Distance" },
  units: { en: "Units", fr: "Unités" },
  resolution: { en: "Resolution", fr: "Résolution" },
  tolerance: { en: "Tolerance", fr: "Tolérance" },
  field: { en: "Field", fr: "Champ" },
  fields: { en: "Fields", fr: "Champs" },
  expression: { en: "Expression", fr: "Expression" },
  source: { en: "Source", fr: "Source" },
  target: { en: "Target", fr: "Cible" },
  layer: { en: "Layer", fr: "Couche" },
  geometry: { en: "Geometry", fr: "Géométrie" },
  predicate: { en: "Predicate", fr: "Prédicat" },
  method: { en: "Method", fr: "Méthode" },
  output_crs: { en: "Output CRS", fr: "SCR de sortie" },
  source_crs: { en: "Source CRS", fr: "SCR source" },
  target_crs: { en: "Target CRS", fr: "SCR cible" },
  bins: { en: "Bins", fr: "Classes" },
  classes: { en: "Classes", fr: "Classes" },
  attribute: { en: "Attribute", fr: "Attribut" },
}

const BY_CAPABILITY: Record<string, Record<string, Bilingual>> = {
  buffer: {
    distance: { en: "Buffer distance", fr: "Distance du tampon" },
    segments: { en: "Segments per quarter", fr: "Segments par quart" },
    cap_style: { en: "Cap style", fr: "Style d'extrémité" },
    join_style: { en: "Join style", fr: "Style de jointure" },
  },
  simplify: {
    tolerance: { en: "Simplification tolerance", fr: "Tolérance de simplification" },
    preserve_topology: { en: "Preserve topology", fr: "Préserver la topologie" },
  },
  spatial_join: {
    predicate: { en: "Join predicate", fr: "Prédicat de jointure" },
    how: { en: "Join type", fr: "Type de jointure" },
  },
  reproject: {
    target_crs: { en: "Target CRS", fr: "SCR cible" },
  },
  classify: {
    attribute: { en: "Attribute to classify", fr: "Attribut à classifier" },
    method: { en: "Classification method", fr: "Méthode de classification" },
    classes: { en: "Number of classes", fr: "Nombre de classes" },
  },
}

export function makeCapabilityTranslator(capability: string, locale: Locale) {
  const overrides = BY_CAPABILITY[capability] ?? {}
  return (key: string, fallback: string): string => {
    const entry = overrides[key] ?? COMMON[key]
    return entry?.[locale] ?? fallback
  }
}
