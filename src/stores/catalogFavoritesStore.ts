/**
 * Catalog favorites store — Issue #143 (Sprint R-6)
 * Persists starred catalog entries to localStorage.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CatalogDomain } from "@/types/catalog"

export interface FavoriteEntry {
  id: string
  domain: CatalogDomain
  name: string
  provider: string
  description: string
  starredAt: string // ISO date
}

interface CatalogFavoritesState {
  favorites: FavoriteEntry[]

  isFavorite: (id: string) => boolean
  addFavorite: (entry: FavoriteEntry) => void
  removeFavorite: (id: string) => void
  toggleFavorite: (entry: FavoriteEntry) => void
  getFavoritesByDomain: (domain: CatalogDomain) => FavoriteEntry[]
  clearFavorites: () => void
}

export const useCatalogFavoritesStore = create<CatalogFavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],

      isFavorite: (id) => get().favorites.some((f) => f.id === id),

      addFavorite: (entry) => {
        const existing = get().favorites.find((f) => f.id === entry.id)
        if (existing) return
        set((s) => ({ favorites: [...s.favorites, { ...entry, starredAt: new Date().toISOString() }] }))
      },

      removeFavorite: (id) => {
        set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) }))
      },

      toggleFavorite: (entry) => {
        if (get().isFavorite(entry.id)) {
          get().removeFavorite(entry.id)
        } else {
          get().addFavorite(entry)
        }
      },

      getFavoritesByDomain: (domain) =>
        get().favorites.filter((f) => f.domain === domain),

      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      name: "gispulse-catalog-favorites",
      version: 1,
    },
  ),
)
