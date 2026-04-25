/**
 * colorRamps.ts — Color ramp library for graduated/heatmap styling.
 *
 * Includes scientific ramps (viridis, magma, etc.), diverging ramps (spectral, RdBu),
 * and qualitative ramps for categorized rendering.
 * Compatible with QGIS standard ramp names for QML roundtrip.
 */

import type { ColorRampDef } from "@/types/layerStyle"

// ── Sequential ramps (continuous numeric data) ────────────────────────

export const SEQUENTIAL_RAMPS: ColorRampDef[] = [
  {
    name: "Viridis",
    colors: ["#440154", "#482777", "#3e4989", "#31688e", "#26838f", "#1f9d8a", "#6cce5a", "#b6de2b", "#fee825"],
  },
  {
    name: "Magma",
    colors: ["#000004", "#180f3d", "#440f76", "#721f81", "#9e2f7f", "#cd4071", "#f1605d", "#feb078", "#fcfdbf"],
  },
  {
    name: "Plasma",
    colors: ["#0d0887", "#46039f", "#7201a8", "#9c179e", "#bd3786", "#d8576b", "#ed7953", "#fb9f3a", "#fdca26"],
  },
  {
    name: "Inferno",
    colors: ["#000004", "#1b0c41", "#4a0c6b", "#781c6d", "#a52c60", "#cf4446", "#ed6925", "#fb9b06", "#fcffa4"],
  },
  {
    name: "Blues",
    colors: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"],
  },
  {
    name: "Greens",
    colors: ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#006d2c", "#00441b"],
  },
  {
    name: "Reds",
    colors: ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#a50f15", "#67000d"],
  },
  {
    name: "YlOrRd",
    colors: ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#bd0026", "#800026"],
  },
  {
    name: "YlGnBu",
    colors: ["#ffffd9", "#edf8b1", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#253494", "#081d58"],
  },
  {
    name: "OrRd",
    colors: ["#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84", "#fc8d59", "#ef6548", "#d7301f", "#b30000", "#7f0000"],
  },
]

// ── Diverging ramps (data with meaningful midpoint) ───────────────────

export const DIVERGING_RAMPS: ColorRampDef[] = [
  {
    name: "Spectral",
    colors: ["#9e0142", "#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"],
  },
  {
    name: "RdBu",
    colors: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061"],
  },
  {
    name: "RdYlGn",
    colors: ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"],
  },
  {
    name: "BrBG",
    colors: ["#543005", "#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#f5f5f5", "#c7eae5", "#80cdc1", "#35978f", "#01665e", "#003c30"],
  },
  {
    name: "PiYG",
    colors: ["#8e0152", "#c51b7d", "#de77ae", "#f1b6da", "#fde0ef", "#f7f7f7", "#e6f5d0", "#b8e186", "#7fbc41", "#4d9221", "#276419"],
  },
]

// ── Qualitative ramps (categorical/discrete data) ─────────────────────

export const QUALITATIVE_RAMPS: ColorRampDef[] = [
  {
    name: "Paired",
    colors: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a", "#ffff99", "#b15928"],
  },
  {
    name: "Set1",
    colors: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628", "#f781bf", "#999999"],
  },
  {
    name: "Set2",
    colors: ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3"],
  },
  {
    name: "Dark2",
    colors: ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#666666"],
  },
  {
    name: "Tab10",
    colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
  },
]

// ── All ramps indexed ─────────────────────────────────────────────────

export const ALL_RAMPS: ColorRampDef[] = [
  ...SEQUENTIAL_RAMPS,
  ...DIVERGING_RAMPS,
  ...QUALITATIVE_RAMPS,
]

export const RAMP_BY_NAME = new Map<string, ColorRampDef>(
  ALL_RAMPS.map((r) => [r.name, r]),
)

// ── Interpolation helpers ─────────────────────────────────────────────

/** Interpolate N colors from a ramp (for graduated classes). */
export function sampleRamp(ramp: ColorRampDef, n: number): string[] {
  const { colors } = ramp
  if (n <= 0) return []
  if (n === 1) return [colors[Math.floor(colors.length / 2)]]
  if (n >= colors.length) return [...colors]

  const result: string[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const idx = t * (colors.length - 1)
    const lo = Math.floor(idx)
    const hi = Math.min(lo + 1, colors.length - 1)
    const frac = idx - lo
    result.push(frac < 0.01 ? colors[lo] : lerpColor(colors[lo], colors[hi], frac))
  }
  return result
}

/** Pick N distinct colors from a qualitative ramp (wraps around). */
export function pickQualitative(ramp: ColorRampDef, n: number): string[] {
  const { colors } = ramp
  return Array.from({ length: n }, (_, i) => colors[i % colors.length])
}

// ── Internal color interpolation ──────────────────────────────────────

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`
}

function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a)
  const [r2, g2, b2] = parseHex(b)
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}
