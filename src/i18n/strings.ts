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
