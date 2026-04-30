/**
 * strings.ts — Central UI string dictionary, FR/EN.
 *
 * Pattern: each entry is a `Bilingual` record. Lookups go through
 * the `useT()` hook (see `i18n/useT.ts`) which reads the active
 * locale from `localeStore` and returns the right variant.
 *
 * Conventions:
 * - Namespaces are dot-separated: "namespace.key" (`common.cancel`).
 * - Keep entries flat — nested objects make grep/IDE-search painful.
 * - One namespace per UI domain (`common`, `dialog`, `toast`, `error`,
 *   `node`, `trigger`, …). Add as needed.
 * - Capability-specific labels live in `capabilityLabels.ts` (separate
 *   indexing strategy, schema-driven). Don't duplicate them here.
 *
 * Migration policy: when you hardcode a string in EN inside a `.tsx`
 * file, add the entry here and switch to `t("namespace.key")`. No need
 * to migrate everything at once — incremental is fine.
 */

export type Bilingual = { en: string; fr: string }

export const STRINGS = {
  // ─── Buttons / actions used across the app ────────────────────────────────
  "common.cancel": { en: "Cancel", fr: "Annuler" },
  "common.confirm": { en: "Confirm", fr: "Confirmer" },
  "common.save": { en: "Save", fr: "Enregistrer" },
  "common.delete": { en: "Delete", fr: "Supprimer" },
  "common.edit": { en: "Edit", fr: "Éditer" },
  "common.close": { en: "Close", fr: "Fermer" },
  "common.retry": { en: "Retry", fr: "Réessayer" },
  "common.loading": { en: "Loading…", fr: "Chargement…" },
  "common.empty": { en: "No data", fr: "Aucune donnée" },
  "common.search": { en: "Search", fr: "Rechercher" },
  "common.copy": { en: "Copy", fr: "Copier" },
  "common.copied": { en: "Copied", fr: "Copié" },

  // ─── Locale toggle (the button itself) ────────────────────────────────────
  "locale.toggle.tooltip": {
    en: "Switch interface language",
    fr: "Changer la langue de l'interface",
  },
  "locale.toggle.label_en": { en: "EN", fr: "EN" },
  "locale.toggle.label_fr": { en: "FR", fr: "FR" },

  // ─── Generic dialog scaffolding ───────────────────────────────────────────
  "dialog.unsaved.title": { en: "Unsaved changes", fr: "Modifications non enregistrées" },
  "dialog.unsaved.body": {
    en: "You have unsaved changes. Discard them?",
    fr: "Vous avez des modifications non enregistrées. Les abandonner ?",
  },
  "dialog.unsaved.discard": { en: "Discard", fr: "Abandonner" },

  // ─── Toasts (success path) ────────────────────────────────────────────────
  "toast.saved": { en: "Saved", fr: "Enregistré" },
  "toast.copied_clipboard": { en: "Copied to clipboard", fr: "Copié dans le presse-papiers" },
  "toast.deleted": { en: "Deleted", fr: "Supprimé" },
  "toast.qml_imported": { en: "QML style applied", fr: "Style QML appliqué" },
  "toast.qml_exported": { en: "QML style downloaded", fr: "Style QML téléchargé" },
  "toast.qml_import_failed": { en: "QML import failed", fr: "Échec de l'import QML" },
  "toast.qml_export_failed": { en: "QML export failed", fr: "Échec de l'export QML" },

  // ─── Style editor (QML import/export) ─────────────────────────────────────
  "style.import_qml": { en: "Import .qml", fr: "Importer .qml" },
  "style.export_qml": { en: "Export .qml", fr: "Exporter .qml" },
  "dialog.import_qml.title": { en: "Replace current style?", fr: "Remplacer le style actuel ?" },
  "dialog.import_qml.body": {
    en: "Importing this QML file will overwrite the current layer style. Continue?",
    fr: "Importer ce fichier QML écrasera le style actuel du layer. Continuer ?",
  },
  "dialog.import_qml.confirm": { en: "Replace", fr: "Remplacer" },

  // ─── Style editor (graduated / categorized / blend / scale) ──────────────
  "style.section.graduated": { en: "Graduated", fr: "Gradué" },
  "style.section.categorized": { en: "Categorized", fr: "Catégorisé" },
  "style.section.blend_mode": { en: "Blend Mode", fr: "Mode de fusion" },
  "style.section.scale_visibility": { en: "Scale Visibility", fr: "Visibilité par échelle" },

  "style.field": { en: "Field", fr: "Champ" },
  "style.field.placeholder_numeric": { en: "Select numeric field…", fr: "Sélectionner un champ numérique…" },
  "style.field.placeholder_any": { en: "Select field…", fr: "Sélectionner un champ…" },
  "style.method": { en: "Method", fr: "Méthode" },
  "style.method.equal_interval": { en: "Equal Interval", fr: "Intervalles égaux" },
  "style.method.quantile": { en: "Quantile", fr: "Quantile" },
  "style.method.natural_breaks": { en: "Natural Breaks", fr: "Seuils naturels" },
  "style.method.std_dev": { en: "Std Deviation", fr: "Écart-type" },
  "style.method.manual": { en: "Manual", fr: "Manuel" },

  "style.classes": { en: "Classes", fr: "Classes" },
  "style.classes_lc": { en: "classes", fr: "classes" },
  "style.ramp": { en: "Ramp", fr: "Palette" },
  "style.ramp.sequential": { en: "Sequential", fr: "Séquentiel" },
  "style.ramp.diverging": { en: "Diverging", fr: "Divergent" },
  "style.ramp.qualitative": { en: "Qualitative", fr: "Qualitative" },
  "style.histogram": { en: "Distribution", fr: "Distribution" },
  "style.classify": { en: "Classify", fr: "Classifier" },
  "style.classifying": { en: "Classifying…", fr: "Classification…" },
  "style.classify.manual_disabled": {
    en: "Switch to a non-manual method to recompute breaks",
    fr: "Choisissez une méthode non manuelle pour recalculer les seuils",
  },
  "style.error.not_enough_breaks": {
    en: "Not enough distinct values to compute class breaks",
    fr: "Pas assez de valeurs distinctes pour calculer les seuils",
  },
  "style.edit_break": { en: "Edit break", fr: "Modifier le seuil" },

  "style.categorized.fetch_distinct": { en: "Fetch distinct values", fr: "Charger les valeurs distinctes" },
  "style.categorized.cap_notice": {
    en: "Showing top {n} values; remaining grouped under \"Other\"",
    fr: "{n} premières valeurs ; les autres regroupées sous « Autre »",
  },
  "style.categorized.other": { en: "Other", fr: "Autre" },
  "style.categorized.summary": {
    en: "{n} categories ({k} values + fallback)",
    fr: "{n} catégories ({k} valeurs + autres)",
  },

  "style.blend_mode.normal": { en: "Normal", fr: "Normal" },
  "style.blend_mode.multiply": { en: "Multiply", fr: "Multiplier" },
  "style.blend_mode.screen": { en: "Screen", fr: "Écran" },
  "style.blend_mode.overlay": { en: "Overlay", fr: "Incrustation" },
  "style.blend_mode.darken": { en: "Darken", fr: "Obscurcir" },
  "style.blend_mode.lighten": { en: "Lighten", fr: "Éclaircir" },
  "style.blend_mode.color_dodge": { en: "Color Dodge", fr: "Densité couleur −" },
  "style.blend_mode.color_burn": { en: "Color Burn", fr: "Densité couleur +" },
  "style.blend_mode.hard_light": { en: "Hard Light", fr: "Lumière crue" },
  "style.blend_mode.soft_light": { en: "Soft Light", fr: "Lumière tamisée" },
  "style.blend_mode.difference": { en: "Difference", fr: "Différence" },
  "style.blend_mode.exclusion": { en: "Exclusion", fr: "Exclusion" },

  "style.scale.min_zoom": { en: "Min Z", fr: "Z min" },
  "style.scale.max_zoom": { en: "Max Z", fr: "Z max" },
  "style.scale.always_visible": { en: "Visible at all zoom levels", fr: "Visible à toutes les échelles" },
  "style.scale.range": { en: "Visible from zoom {min} to {max}", fr: "Visible de l'échelle {min} à {max}" },
  "style.scale.zoom_to_layer": { en: "Zoom to layer extent", fr: "Zoomer sur l'étendue du layer" },

  // ─── Node property panel ──────────────────────────────────────────────────
  "node.properties.parameters_heading": { en: "Parameters", fr: "Paramètres" },

  // ─── Error messages (user-facing) ─────────────────────────────────────────
  "error.network": {
    en: "Network error. Check your connection and retry.",
    fr: "Erreur réseau. Vérifiez votre connexion et réessayez.",
  },
  "error.unauthorized": {
    en: "Session expired. Sign in again.",
    fr: "Session expirée. Reconnectez-vous.",
  },
  "error.unknown": {
    en: "Something went wrong. Please retry.",
    fr: "Une erreur est survenue. Veuillez réessayer.",
  },
} as const satisfies Record<string, Bilingual>

export type StringKey = keyof typeof STRINGS
