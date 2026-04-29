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
 * Snapshot strategy
 * -----------------
 * The helper captures `getState()` once before the first test (in
 * `beforeAll`) and restores it via `setState(snapshot, true)` in
 * `afterEach`. **No deep-clone** — the snapshot keeps function
 * references intact so action methods (e.g. `setLocale`,
 * `setNodeExecState`, `fetchRules`) survive the restore.
 *
 * This codebase declares store actions on the state object via the
 * canonical `create((set, get) => ({ field, action: () => ... }))`
 * pattern, so the actions LIVE on the state. A JSON deep-clone reset
 * would drop those functions and the next test that triggers a
 * handler calling them crashes with `TypeError: x is not a function`.
 *
 * Tradeoff: if a test mutates a nested object in place
 * (`state.items.push(...)`), the mutation leaks into the snapshot's
 * nested reference. Idiomatic zustand actions create new objects
 * (immutable updates), so this is rarely a problem. If you hit it,
 * do `useStore.setState({ items: [...newItems] })` instead of mutating
 * an array in place.
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
      // Capture the state object reference directly. JSON deep-clone
      // would drop the action functions (this codebase keeps actions
      // on the state object) — see the doc comment at the top.
      snapshots.set(store, store.getState())
    }
  })

  afterEach(() => {
    for (const store of stores) {
      const snapshot = snapshots.get(store)
      if (snapshot !== undefined) {
        // Replace mode (second arg `true`) wipes any keys added during
        // the test — without it, an extra key set via setState would
        // survive the restore. We rebuild a fresh top-level object so
        // a test that does `state.foo = ...` (rare) doesn't tamper
        // with our cached snapshot's identity.
        store.setState(
          { ...(snapshot as Record<string, unknown>) } as never,
          true,
        )
      }
    }
  })
}
