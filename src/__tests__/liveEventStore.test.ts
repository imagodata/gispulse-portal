import { describe, it, expect, beforeEach } from "vitest"
import { useLiveEventStore } from "@/hooks/useLiveEvents"

const MAX_EVENTS = 500

describe("useLiveEventStore — ring buffer", () => {
  beforeEach(() => {
    useLiveEventStore.getState().clearEvents()
  })

  it("starts with empty events", () => {
    expect(useLiveEventStore.getState().events).toHaveLength(0)
  })

  it("pushes events up to MAX_EVENTS limit", () => {
    const store = useLiveEventStore.getState()
    // Push MAX_EVENTS + 10 events
    for (let i = 0; i < MAX_EVENTS + 10; i++) {
      store.pushEvent({
        type: "test",
        data: { i },
        timestamp: new Date().toISOString(),
      })
    }
    expect(useLiveEventStore.getState().events.length).toBe(MAX_EVENTS)
  })

  it("keeps the most recent events (ring buffer behaviour)", () => {
    const store = useLiveEventStore.getState()
    for (let i = 0; i < MAX_EVENTS + 5; i++) {
      store.pushEvent({
        type: "test",
        data: { seq: i },
        timestamp: new Date().toISOString(),
      })
    }
    const events = useLiveEventStore.getState().events
    const last = events[events.length - 1]
    expect((last.data as { seq: number }).seq).toBe(MAX_EVENTS + 4)
  })

  it("clearEvents resets the buffer", () => {
    const store = useLiveEventStore.getState()
    store.pushEvent({ type: "x", data: {}, timestamp: "" })
    store.clearEvents()
    expect(useLiveEventStore.getState().events).toHaveLength(0)
  })
})
