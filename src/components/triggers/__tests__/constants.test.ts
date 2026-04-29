/**
 * Unit tests for `triggers/constants.ts` — taxonomy invariants and helpers.
 *
 * Why this matters: `constants.ts` is the single source of truth for the
 * Trigger Builder UI's option lists (DML events, threshold ops, validation
 * rules, action types, spatial ops). Drift between this file and the
 * `editor.ts` types — or accidental duplicates / orphans — surfaces as
 * silent rendering bugs ("disabled action stays clickable", "category icon
 * missing"). The runtime checks here catch the drift at build time.
 */

import { describe, expect, it } from "vitest"

import {
  ACTION_TYPES,
  CATEGORY_ICONS,
  DML_EVENTS,
  SEVERITY_LEVELS,
  SPATIAL_OPS_AFTER,
  SPATIAL_OPS_BEFORE,
  THRESHOLD_OPS,
  TOPOLOGY_CHECKS,
  TRIGGER_CATEGORIES,
  TRIGGER_TYPES,
  VALIDATION_RULES,
  categoryForType,
  emptyOperation,
} from "../constants"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("emptyOperation", () => {
  it("returns a TriggerOperation with sane defaults", () => {
    const op = emptyOperation()
    expect(op.schema).toBe("")
    expect(op.table).toBe("")
    expect(op.field).toBe("")
    expect(op.phase).toBe("before")
    expect(op.operation).toBe("st_within")
    expect(op.event).toBe("INSERT,UPDATE")
    expect(op.enabled).toBe(true)
  })

  it("returns a fresh instance each call (no shared mutable state)", () => {
    const a = emptyOperation()
    const b = emptyOperation()
    expect(a).not.toBe(b) // distinct references
    a.table = "mutated"
    expect(b.table).toBe("") // mutation does not leak
  })
})

describe("categoryForType", () => {
  it("returns the correct category for each declared TRIGGER_TYPES entry", () => {
    for (const tt of TRIGGER_TYPES) {
      expect(categoryForType(tt.value)).toBe(tt.category)
    }
  })

  it("falls back to 'data' for unknown trigger types", () => {
    // @ts-expect-error — testing the unknown-type fallback path
    expect(categoryForType("not_a_real_type")).toBe("data")
  })
})

// ---------------------------------------------------------------------------
// Taxonomy invariants — drift detectors
// ---------------------------------------------------------------------------

describe("TRIGGER_TYPES taxonomy", () => {
  it("has unique values (no duplicate trigger keys)", () => {
    const values = TRIGGER_TYPES.map((t) => t.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it("references valid categories declared in TRIGGER_CATEGORIES", () => {
    const validCategories = new Set(TRIGGER_CATEGORIES.map((c) => c.value))
    for (const tt of TRIGGER_TYPES) {
      expect(validCategories).toContain(tt.category)
    }
  })

  it("provides every required field (label, icon, description)", () => {
    for (const tt of TRIGGER_TYPES) {
      expect(tt.label.length).toBeGreaterThan(0)
      expect(tt.icon).toBeTruthy()
      expect(tt.description.length).toBeGreaterThan(0)
    }
  })
})

describe("TRIGGER_CATEGORIES taxonomy", () => {
  it("has unique values", () => {
    const values = TRIGGER_CATEGORIES.map((c) => c.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it("matches CATEGORY_ICONS keys exactly (no orphan icons, no missing icons)", () => {
    const categoryValues = new Set(TRIGGER_CATEGORIES.map((c) => c.value))
    const iconKeys = new Set(Object.keys(CATEGORY_ICONS))
    expect(iconKeys).toEqual(categoryValues)
  })
})

describe("CATEGORY_ICONS — every TRIGGER_TYPES.category resolves to an icon", () => {
  it("never produces an undefined icon lookup", () => {
    for (const tt of TRIGGER_TYPES) {
      const icon = CATEGORY_ICONS[tt.category]
      expect(icon).toBeTruthy()
    }
  })
})

describe("ACTION_TYPES", () => {
  it("has unique action values", () => {
    const values = ACTION_TYPES.map((a) => a.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it("disabled actions all have a 'coming soon' label hint", () => {
    // Convention: any action with `disabled: true` should signal the
    // upcoming nature so the user understands why it's greyed out.
    for (const a of ACTION_TYPES) {
      if (a.disabled) {
        expect(a.label.toLowerCase()).toContain("coming soon")
      }
    }
  })

  it("groups actions into known categories", () => {
    const knownCategories = new Set([
      "notification",
      "mutation",
      "execution",
      "workflow",
      "external",
    ])
    for (const a of ACTION_TYPES) {
      expect(knownCategories).toContain(a.category)
    }
  })
})

describe("DML_EVENTS", () => {
  it("contains exactly INSERT, UPDATE, DELETE", () => {
    expect(DML_EVENTS).toEqual(["INSERT", "UPDATE", "DELETE"])
  })
})

describe("THRESHOLD_OPS / TOPOLOGY_CHECKS / VALIDATION_RULES — uniqueness", () => {
  it.each([
    ["THRESHOLD_OPS", THRESHOLD_OPS],
    ["TOPOLOGY_CHECKS", TOPOLOGY_CHECKS],
    ["VALIDATION_RULES", VALIDATION_RULES],
  ])("%s has unique values", (_name, list) => {
    const values = (list as { value: string }[]).map((x) => x.value)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe("SEVERITY_LEVELS", () => {
  it("ordered from least to most severe (info → critical)", () => {
    const order = SEVERITY_LEVELS.map((s) => s.value)
    expect(order).toEqual(["info", "warning", "error", "critical"])
  })

  it("each level has icon + tailwind text/bg color classes", () => {
    for (const lvl of SEVERITY_LEVELS) {
      expect(lvl.icon).toBeTruthy()
      expect(lvl.color).toMatch(/^text-/)
      expect(lvl.bg).toMatch(/^bg-/)
    }
  })
})

describe("SPATIAL_OPS — phase split", () => {
  it("BEFORE and AFTER both have non-empty operation lists", () => {
    expect(SPATIAL_OPS_BEFORE.length).toBeGreaterThan(0)
    expect(SPATIAL_OPS_AFTER.length).toBeGreaterThan(0)
  })

  it("each operation entry has label + description", () => {
    for (const op of [...SPATIAL_OPS_BEFORE, ...SPATIAL_OPS_AFTER]) {
      expect(op.label.length).toBeGreaterThan(0)
      expect(op.description.length).toBeGreaterThan(0)
    }
  })

  it("custom_expression is offered in both phases (escape hatch)", () => {
    expect(SPATIAL_OPS_BEFORE.some((o) => o.value === "custom_expression")).toBe(true)
    expect(SPATIAL_OPS_AFTER.some((o) => o.value === "custom_expression")).toBe(true)
  })
})
