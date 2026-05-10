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

  // ─── Settings panel (Mode 2 portal — issue #30) ──────────────────────────
  "settings.title": { en: "Settings", fr: "Paramètres" },
  "settings.open_label": { en: "Open settings", fr: "Ouvrir les paramètres" },
  "settings.section.backend": { en: "Backend engine", fr: "Moteur backend" },
  "settings.backend.description": {
    en: "Connect the portal to your local gispulse engine, or stay on the public demo.",
    fr: "Connectez le portail à votre moteur gispulse local, ou restez sur la démo publique.",
  },
  "settings.backend.url_label": { en: "Backend URL", fr: "URL du backend" },
  "settings.backend.url_placeholder": {
    en: "http://127.0.0.1:8001",
    fr: "http://127.0.0.1:8001",
  },
  "settings.backend.url_hint": {
    en: "Leave empty to use the public demo. Run `gispulse engine` to host one locally.",
    fr: "Laissez vide pour utiliser la démo publique. Lancez `gispulse engine` pour en héberger un en local.",
  },
  "settings.backend.healthcheck": { en: "Test connection", fr: "Tester la connexion" },
  "settings.backend.checking": { en: "Checking…", fr: "Vérification…" },
  "settings.backend.health_ok": {
    en: "Reachable ({ms} ms)",
    fr: "Joignable ({ms} ms)",
  },
  "settings.backend.health_fail": { en: "Unreachable", fr: "Injoignable" },
  "settings.backend.save": { en: "Save & connect", fr: "Enregistrer et connecter" },
  "settings.backend.reset": { en: "Reset to demo", fr: "Réinitialiser à la démo" },

  "error.backend_url.empty": {
    en: "URL is required when leaving demo mode.",
    fr: "Une URL est requise pour quitter la démo.",
  },
  "error.backend_url.scheme": {
    en: "Only http:// and https:// URLs are supported.",
    fr: "Seules les URL http:// et https:// sont acceptées.",
  },
  "error.backend_url.format": {
    en: "Invalid URL format.",
    fr: "Format d'URL invalide.",
  },
  "error.backend_url.trailing_path": {
    en: "Drop the path — host only (e.g. https://api.example.com).",
    fr: "Retirez le chemin — hôte seul (ex. https://api.example.com).",
  },

  // ─── Mode banner (Mode 2 portal — issue #31) ─────────────────────────────
  "mode.banner.demo": { en: "Demo (read-only)", fr: "Démo (lecture seule)" },
  "mode.banner.connected": {
    en: "Connected to {host}",
    fr: "Connecté à {host}",
  },
  "mode.banner.disconnected": {
    en: "Engine unreachable — {host}",
    fr: "Moteur injoignable — {host}",
  },
  "mode.banner.switch_to_engine": {
    en: "Use my engine",
    fr: "Utiliser mon moteur",
  },
  "mode.banner.switch_to_demo": {
    en: "Back to demo",
    fr: "Retour à la démo",
  },
  "mode.readonly.title": {
    en: "Read-only demo",
    fr: "Démo en lecture seule",
  },
  "mode.readonly.body": {
    en: "Connect your own gispulse engine to save changes. The public demo can only be browsed.",
    fr: "Connectez votre propre moteur gispulse pour enregistrer vos modifications. La démo publique est consultable uniquement.",
  },
  "mode.readonly.cta_docs": { en: "How to connect", fr: "Comment se connecter" },
  "mode.readonly.cta_settings": { en: "Open settings", fr: "Ouvrir les paramètres" },

  // ─── Mode toggle (header segmented control — issue #31) ───────────────────
  "mode.toggle.try_it": { en: "Try it", fr: "Essayer" },
  "mode.toggle.my_engine": { en: "My engine", fr: "Mon moteur" },
  "mode.toggle.readonly_tooltip": {
    en: "Read-only on demo — switch to My engine to run your own pipelines",
    fr: "Lecture seule sur la démo — passez à Mon moteur pour exécuter vos pipelines",
  },

  // ─── Mixed-content warning banner (issue #42) ─────────────────────────────
  "mixed_content.banner": {
    en: "Mixed content: your browser will block requests from HTTPS to your local HTTP backend. Use `gispulse portal` to bind the SPA same-origin, or run portal over HTTPS.",
    fr: "Contenu mixte : votre navigateur bloquera les requêtes HTTPS vers votre backend HTTP local. Utilisez `gispulse portal` pour un montage same-origin, ou accédez au portail via HTTPS.",
  },
  "mixed_content.learn_more": { en: "Learn more", fr: "En savoir plus" },

  // ─── Cocarte (v1.7 Publish — issue #56) ───────────────────────────────────
  "cocarte.maps.title": { en: "My maps", fr: "Mes cartes" },
  "cocarte.maps.empty": {
    en: "No maps yet. Create one to start publishing.",
    fr: "Aucune carte. Créez-en une pour commencer à publier.",
  },
  "cocarte.maps.create": { en: "New map", fr: "Nouvelle carte" },
  "cocarte.maps.create.title_label": { en: "Map title", fr: "Titre de la carte" },
  "cocarte.maps.create.title_placeholder": {
    en: "e.g. Election results 2026",
    fr: "ex. Résultats des élections 2026",
  },
  "cocarte.maps.delete.confirm": {
    en: "Move this map to trash?",
    fr: "Déplacer cette carte vers la corbeille ?",
  },
  "cocarte.maps.restore": { en: "Restore", fr: "Restaurer" },
  "cocarte.maps.trash": { en: "Trash", fr: "Corbeille" },
  "cocarte.maps.trash.empty": {
    en: "Trash is empty.",
    fr: "La corbeille est vide.",
  },

  // Visibility states
  "cocarte.visibility.private": { en: "Private", fr: "Privée" },
  "cocarte.visibility.unlisted": { en: "Unlisted", fr: "Non listée" },
  "cocarte.visibility.public": { en: "Public", fr: "Publique" },
  "cocarte.visibility.private.help": {
    en: "Only you can see this map.",
    fr: "Vous seul pouvez voir cette carte.",
  },
  "cocarte.visibility.unlisted.help": {
    en: "Anyone with the share link can view this map.",
    fr: "Toute personne disposant du lien peut voir cette carte.",
  },
  "cocarte.visibility.public.help": {
    en: "This map appears in the public gallery.",
    fr: "Cette carte apparaît dans la galerie publique.",
  },

  // Share token
  "cocarte.share.copy_link": { en: "Copy share link", fr: "Copier le lien de partage" },
  "cocarte.share.rotate": { en: "Rotate share link", fr: "Régénérer le lien" },
  "cocarte.share.rotate.confirm": {
    en: "Previously shared links will stop working. Continue?",
    fr: "Les liens précédemment partagés cesseront de fonctionner. Continuer ?",
  },
  "cocarte.share.rotated": { en: "Share link rotated", fr: "Lien régénéré" },

  // Tier gate
  "cocarte.tier.limit_reached.title": {
    en: "Map limit reached",
    fr: "Limite de cartes atteinte",
  },
  "cocarte.tier.limit_reached.body": {
    en: "Your tier allows {limit} maps. Upgrade to Pro for 100, or Team for unlimited.",
    fr: "Votre offre autorise {limit} cartes. Passez à Pro pour 100 cartes, ou Équipe pour un nombre illimité.",
  },
} as const satisfies Record<string, Bilingual>

export type StringKey = keyof typeof STRINGS
