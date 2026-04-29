import { describe, expect, it, beforeEach } from "vitest"

import { useLocaleStore } from "@/stores/localeStore"
import { translate } from "../useT"
import type { StringKey } from "../strings"

describe("translate (locale-agnostic)", () => {
  it("returns the EN variant in EN locale", () => {
    expect(translate("common.cancel", "en")).toBe("Cancel")
    expect(translate("common.save", "en")).toBe("Save")
  })

  it("returns the FR variant in FR locale", () => {
    expect(translate("common.cancel", "fr")).toBe("Annuler")
    expect(translate("common.save", "fr")).toBe("Enregistrer")
  })

  it("falls back to the key when the entry is unknown", () => {
    // @ts-expect-error — testing the unknown-key fallback path
    expect(translate("nonexistent.key", "en")).toBe("nonexistent.key")
  })

  it("covers every advertised namespace", () => {
    // Smoke check — keys exist in every namespace we documented.
    const required: StringKey[] = [
      "common.cancel",
      "locale.toggle.tooltip",
      "dialog.unsaved.title",
      "toast.saved",
      "error.network",
    ]
    for (const key of required) {
      expect(translate(key, "en")).toBeTruthy()
      expect(translate(key, "fr")).toBeTruthy()
    }
  })
})

describe("useT integration with localeStore", () => {
  beforeEach(() => {
    // Reset to EN before each test so the store doesn't leak state.
    useLocaleStore.getState().setLocale("en")
  })

  it("translate matches the active locale", () => {
    useLocaleStore.getState().setLocale("fr")
    expect(translate("common.delete", useLocaleStore.getState().locale)).toBe("Supprimer")

    useLocaleStore.getState().setLocale("en")
    expect(translate("common.delete", useLocaleStore.getState().locale)).toBe("Delete")
  })
})
