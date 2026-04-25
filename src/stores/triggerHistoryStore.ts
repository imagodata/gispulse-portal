import { create } from "zustand"

export interface TriggerFireEvent {
  id: string
  triggerId: string
  triggerName: string
  matched: boolean
  operation?: string
  table?: string
  evalTimeMs: number
  actionsDispatched: string[]
  cascadeDepth: number
  firedAt: string
}

interface TriggerHistoryState {
  events: TriggerFireEvent[]
  pushEvent: (event: TriggerFireEvent) => void
  clearEvents: () => void
}

const MAX_EVENTS = 200

export const useTriggerHistoryStore = create<TriggerHistoryState>((set) => ({
  events: [],
  pushEvent: (event) =>
    set((s) => ({ events: [event, ...s.events].slice(0, MAX_EVENTS) })),
  clearEvents: () => set({ events: [] }),
}))
