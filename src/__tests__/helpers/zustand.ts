/**
 * zustand test helpers — snapshot/restore the initial store state so
 * one test's mutations don't leak into the next.
 *
 * Why it's needed: zustand `create(...)` produces a module-level
 * singleton. State mutations from `setState()` or store actions
 * persist across tests in the same module load. Tests that touch the
 * same store get order-dependent and flake silently.
 *
 * Usage :
 *
 *   import { useEditorStore } from "@/stores/editorStore"
 *   import { setupStoreReset } from "@/__tests__/helpers/zustand"
 *
 *   describe("MyComponent", () => {
 *     setupStoreReset(useEditorStore)
 *
 *     it("renders with default state", () => { ... })
 *     it("reacts to state mutation", () => {
 *       useEditorStore.setState({ activeScenarioId: "x" })
 *       // ... assertions ...
 *     })
 *   })
 *
 * For multiple stores in one suite :
 *
 *   setupStoreReset(useEditorStore, useDatasetStore, useProjectStore)
 *
 * The helper takes a snapshot of `getState()` at first call and uses
 * `setState(snapshot, true)` (replace = true) to restore in `afterEach`.
 * The snapshot is captured once per test module, before the first test
 * runs — assuming the store hasn't been mutated at module-load time.
 */

import { afterEach, beforeAll } from "vitest"

interface ZustandStore<T> {
  getState: () => T
  setState: (
    partial: T | Partial<T> | ((state: T) => T | Partial<T>),
    replace?: true,
  ) => void
}

export function setupStoreReset<TStores extends ZustandStore<unknown>[]>(
  ...stores: TStores
): void {
  const snapshots = new Map<ZustandStore<unknown>, unknown>()

  beforeAll(() => {
    for (const store of stores) {
      // Deep-clone via JSON to avoid sharing nested arrays/objects with
      // the running state (a `setState({ items: [...] })` would mutate
      // the snapshot otherwise). Functions are dropped — zustand actions
      // live on the store closure, not on the state object, so this is
      // safe for the default store shape. If a store puts callbacks in
      // state (rare), use the store's own `_reset()` helper instead.
      snapshots.set(store, JSON.parse(JSON.stringify(store.getState())))
    }
  })

  afterEach(() => {
    for (const store of stores) {
      const snapshot = snapshots.get(store)
      if (snapshot !== undefined) {
        // Replace mode (second arg `true`) wipes any keys added during
        // the test — without it, an extra key set via setState would
        // survive the restore. We re-clone so subsequent tests can't
        // mutate the snapshot.
        store.setState(JSON.parse(JSON.stringify(snapshot)) as never, true)
      }
    }
  })
}
