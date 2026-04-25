import { describe, it, expect } from "vitest"

// Inline the fuzzy scoring logic from CommandPalette for unit testing
function fuzzyScore(query: string, text: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const idx = t.indexOf(q)
  if (idx === -1) {
    let qi = 0
    let score = 0
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        score += 1 - i / t.length
        qi++
      }
    }
    return qi === q.length ? score / q.length : 0
  }
  return 1 + (idx === 0 ? 0.5 : 0)
}

describe("CommandPalette — fuzzyScore", () => {
  it("returns 1 for empty query", () => {
    expect(fuzzyScore("", "anything")).toBe(1)
  })

  it("matches exact substring — higher score for prefix", () => {
    const prefixScore = fuzzyScore("map", "map workspace")
    const midScore = fuzzyScore("map", "open map view")
    expect(prefixScore).toBeGreaterThan(midScore)
  })

  it("returns 0 when no match", () => {
    expect(fuzzyScore("xyz", "abc def")).toBe(0)
  })

  it("matches scattered characters (fuzzy)", () => {
    const score = fuzzyScore("mp", "map")
    expect(score).toBeGreaterThan(0)
  })

  it("is case-insensitive", () => {
    const lower = fuzzyScore("map", "Map Workspace")
    const upper = fuzzyScore("MAP", "map workspace")
    expect(lower).toBe(upper)
  })
})
