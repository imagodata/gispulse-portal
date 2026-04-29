/**
 * Validation tests for setupStoreReset — uses the real localeStore
 * since it has a stable initial state and no side-effects on import.
 *
 * Demonstrates the contract :
 *   beforeAll  → snapshot the store's initial state
 *   afterEach  → restore that snapshot (via setState replace = true)
 *
 * If the test order is correct, every `it` starts with the original
 * locale regardless of what previous tests did.
 */

import { describe, expect, it } from "vitest"
import { useLocaleStore } from "@/stores/localeStore"
import { setupStoreReset } from "../zustand"

describe("setupStoreReset — single store", () => {
  // Capture the value seen on this test module's first render so we
  // can compare each `it` start state against it.
  const initialLocale = useLocaleStore.getState().locale

  setupStoreReset(useLocaleStore)

  it("first test sees the initial locale", () => {
    expect(useLocaleStore.getState().locale).toBe(initialLocale)
  })

  it("a mutation in one test...", () => {
    useLocaleStore.setState({ locale: "fr" })
    expect(useLocaleStore.getState().locale).toBe("fr")
  })

  it("...does not leak into the next test", () => {
    expect(useLocaleStore.getState().locale).toBe(initialLocale)
  })

  it("setState with new keys is wiped (replace mode = true)", () => {
    // Add an extra key the store doesn't normally carry
    useLocaleStore.setState({
      locale: "fr",
      // @ts-expect-error — intentionally adding an off-schema key
      extraKey: "should-be-wiped",
    })
    expect(useLocaleStore.getState().locale).toBe("fr")
    // @ts-expect-error — checking the key existed before reset
    expect(useLocaleStore.getState().extraKey).toBe("should-be-wiped")
  })

  it("after the previous test, both the locale and the extra key are gone", () => {
    expect(useLocaleStore.getState().locale).toBe(initialLocale)
    // @ts-expect-error — checking the key was removed
    expect(useLocaleStore.getState().extraKey).toBeUndefined()
  })
})
