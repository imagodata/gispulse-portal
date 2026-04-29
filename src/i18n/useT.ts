/**
 * useT — bilingual string lookup hook.
 *
 *   const t = useT()
 *   <button>{t("common.cancel")}</button>
 *
 * The hook reads the active locale from `localeStore` and returns a
 * stable function that walks `STRINGS` for the requested key. Unknown
 * keys (typos, deleted entries, mid-rebase) fall back to the key itself
 * so the UI never blanks out — easy to spot in QA.
 *
 * For dynamic interpolation, wrap the result :
 *
 *   const t = useT()
 *   const msg = t("dataset.upload.progress").replace("{n}", String(count))
 *
 * (Yes, pure-string interpolation. We deliberately don't ship ICU /
 * MessageFormat here — the bespoke pattern stays simple. If we ever
 * need plural rules across locales, the `localeStore` already exposes
 * `Intl.PluralRules(locale)` indirectly via `navigator.language`.)
 */

import { useCallback } from "react"

import { useLocaleStore } from "@/stores/localeStore"
import { STRINGS, type StringKey } from "./strings"

export function useT(): (key: StringKey) => string {
  const locale = useLocaleStore((s) => s.locale)
  return useCallback(
    (key: StringKey): string => {
      const entry = STRINGS[key]
      if (!entry) {
        // Unknown key — return the key itself so QA can grep for it
        // without the UI blanking out. Not throwing so a missing
        // mid-rebase string never breaks the page.
        return key
      }
      return entry[locale] ?? entry.en
    },
    [locale],
  )
}

/**
 * Locale-agnostic variant for unit tests / non-React callers. Pass the
 * locale explicitly. Same fallback rules as `useT()`.
 */
export function translate(key: StringKey, locale: "en" | "fr"): string {
  const entry = STRINGS[key]
  if (!entry) return key
  return entry[locale] ?? entry.en
}
