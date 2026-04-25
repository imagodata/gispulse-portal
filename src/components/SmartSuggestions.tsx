/**
 * SmartSuggestions — Contextual catalog suggestions based on the detected country/CRS.
 *
 * Issue #189 (A7-S3): extracted from CatalogView.tsx and integrated into CatalogWorkspace.
 * Extends coverage to Luxembourg + DOM-TOM.
 */

import { Badge } from "@/components/ui/badge"
import { useCatalogStore } from "@/stores/catalogStore"
import type { CatalogDomain } from "@/types/catalog"

interface Suggestion {
  label: string
  domain: CatalogDomain
  search?: string
  badge?: string
}

// ---------------------------------------------------------------------------
// Suggestion builder — extended with Luxembourg + DOM-TOM (#189)
// ---------------------------------------------------------------------------

export function buildSuggestions(country: string, epsgCodes: string[]): Suggestion[] {
  const suggestions: Suggestion[] = []

  if (country === "france") {
    suggestions.push(
      { label: "IGN Geoplateforme", domain: "flux", search: "", badge: "WMS/WMTS" },
      { label: "BD TOPO", domain: "opendata", search: "bdtopo", badge: "IGN" },
      { label: "ADMIN EXPRESS", domain: "opendata", search: "admin", badge: "IGN" },
      { label: "Cadastre", domain: "opendata", search: "parcellaire", badge: "IGN" },
      { label: "Plan IGN", domain: "basemap", search: "ign" },
      { label: "Ortho IGN", domain: "basemap", search: "ortho" },
    )
    if (!epsgCodes.includes("EPSG:2154")) {
      suggestions.push({ label: "Lambert 93", domain: "projection", search: "2154", badge: "EPSG:2154" })
    }
  } else if (country === "belgique") {
    suggestions.push(
      { label: "NGI Cartes", domain: "basemap", search: "ngi" },
      { label: "WalOnMap", domain: "flux", search: "walonmap", badge: "WMS" },
      { label: "Lambert 72", domain: "projection", search: "31370", badge: "EPSG:31370" },
      { label: "BD Référence", domain: "opendata", search: "belgique", badge: "IGN-BE" },
    )
  } else if (country === "suisse") {
    suggestions.push(
      { label: "Swisstopo", domain: "basemap", search: "swisstopo" },
      { label: "Swisstopo WMS", domain: "flux", search: "swisstopo", badge: "WMS" },
      { label: "CH1903+ / LV95", domain: "projection", search: "2056", badge: "EPSG:2056" },
      { label: "Open Data Swiss", domain: "opendata", search: "swiss", badge: "OFS" },
    )
  } else if (country === "luxembourg") {
    suggestions.push(
      { label: "Geoportail Lu", domain: "basemap", search: "luxembourg" },
      { label: "ACT WMS", domain: "flux", search: "luxembourg", badge: "WMS" },
      { label: "Luxembourg 1930", domain: "projection", search: "2169", badge: "EPSG:2169" },
      { label: "Open Data LU", domain: "opendata", search: "luxembourg" },
    )
  } else if (country === "martinique") {
    suggestions.push(
      { label: "IGN Martinique", domain: "flux", search: "martinique", badge: "WMS" },
      { label: "RRAF91 / UTM20N", domain: "projection", search: "5490", badge: "EPSG:5490" },
    )
  } else if (country === "reunion") {
    suggestions.push(
      { label: "IGN Réunion", domain: "flux", search: "reunion", badge: "WMS" },
      { label: "RGR92 / UTM40S", domain: "projection", search: "2975", badge: "EPSG:2975" },
    )
  } else if (country === "guyane") {
    suggestions.push(
      { label: "IGN Guyane", domain: "flux", search: "guyane", badge: "WMS" },
      { label: "RGFG95 / UTM22N", domain: "projection", search: "2972", badge: "EPSG:2972" },
    )
  } else if (country === "guadeloupe") {
    suggestions.push(
      { label: "IGN Guadeloupe", domain: "flux", search: "guadeloupe", badge: "WMS" },
      { label: "RRAF91 / UTM20N", domain: "projection", search: "5490", badge: "EPSG:5490" },
    )
  }

  return suggestions
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SmartSuggestionsProps {
  country: string
  epsgCodes: string[]
}

export function SmartSuggestions({ country, epsgCodes }: SmartSuggestionsProps) {
  const setTab = useCatalogStore((s) => s.setTab)
  const setSearch = useCatalogStore((s) => s.setSearch)

  const suggestions = buildSuggestions(country, epsgCodes)
  if (suggestions.length === 0) return null

  return (
    <div className="border-b bg-muted/30 px-3 py-2 shrink-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-label font-semibold uppercase tracking-wider text-muted-foreground">
          Suggested for your data
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => {
              setTab(s.domain)
              if (s.search !== undefined) setSearch(s.search)
            }}
            className="rounded-md border bg-background px-2.5 py-1 text-label-lg hover:bg-accent transition-colors"
          >
            <span className="font-medium">{s.label}</span>
            {s.badge && (
              <Badge variant="secondary" className="ml-1.5 text-label-sm">
                {s.badge}
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
