import { create } from "zustand"

export type Locale = "en" | "fr"

const STORAGE_KEY = "gispulse:locale"

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en"
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "en" || stored === "fr") return stored
  const nav = window.navigator?.language?.toLowerCase() ?? ""
  return nav.startsWith("fr") ? "fr" : "en"
}

interface LocaleState {
  locale: Locale
  setLocale: (l: Locale) => void
  toggleLocale: () => void
}

const initial = detectLocale()

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: initial,
  setLocale: (l: Locale) => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l)
    set({ locale: l })
  },
  toggleLocale: () => {
    const next: Locale = get().locale === "en" ? "fr" : "en"
    get().setLocale(next)
  },
}))
