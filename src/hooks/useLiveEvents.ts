import { useEffect, useRef, useCallback } from "react"
import { create } from "zustand"
import { useHealthStore } from "@/hooks/useHealthCheck"

// ------------------------------------------------------------------
// Live event types
// ------------------------------------------------------------------

export interface LiveEvent {
  type: string
  data: Record<string, unknown>
  timestamp: string
}

// ------------------------------------------------------------------
// Typed WS event constants (#157)
// ------------------------------------------------------------------

export const WS_EVENT = {
  TRIGGER_FIRED: "trigger_fired",
  JOB_STARTED: "job_started",
  JOB_COMPLETED: "job_completed",
  JOB_FAILED: "job_failed",
  DATASET_UPDATED: "dataset_updated",
  LAYER_CHANGED: "layer_changed",
  SESSION_CLOSED: "session_closed",
  SCENARIO_CHANGED: "scenario_changed",
} as const

export type WsEventType = (typeof WS_EVENT)[keyof typeof WS_EVENT]

export interface TriggerFiredEvent extends LiveEvent {
  type: typeof WS_EVENT.TRIGGER_FIRED
  data: { trigger_id: string; trigger_name: string; feature_count: number }
}

export interface JobEvent extends LiveEvent {
  type: typeof WS_EVENT.JOB_STARTED | typeof WS_EVENT.JOB_COMPLETED | typeof WS_EVENT.JOB_FAILED
  data: { job_id: string; job_type: string; progress?: number; error?: string }
}

// ------------------------------------------------------------------
// Store — last N events + connection status
// ------------------------------------------------------------------

/** Internal event type augmented with a stable sequence number for React keys (#216) */
export interface StoredLiveEvent extends LiveEvent {
  _seq: number
}

interface LiveEventState {
  connected: boolean
  events: StoredLiveEvent[]
  setConnected: (v: boolean) => void
  pushEvent: (e: LiveEvent) => void
  clearEvents: () => void
}

const MAX_EVENTS = 500
// Monotonically increasing sequence counter — never resets between clears
let _eventSeq = 0

export const useLiveEventStore = create<LiveEventState>((set) => ({
  connected: false,
  events: [],
  setConnected: (connected) => set({ connected }),
  pushEvent: (e) =>
    set((s) => {
      const stored: StoredLiveEvent = { ...e, _seq: ++_eventSeq }
      return { events: [...s.events.slice(-(MAX_EVENTS - 1)), stored] }
    }),
  clearEvents: () => set({ events: [] }),
}))

// ------------------------------------------------------------------
// Hook — auto-connect WebSocket (silent when backend is down)
// Backoff exponentiel : 1s → 2s → 4s → 8s → 16s → 30s cap (#210)
// ------------------------------------------------------------------

const BACKOFF_BASE_MS = 1_000
const BACKOFF_MAX_MS = 30_000

/** Compute delay for attempt n: 1s * 2^n, capped at 30s */
function backoffDelay(attempt: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS)
}

export function useLiveEvents() {
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const mountedRef = useRef(true)
  const { setConnected, pushEvent } = useLiveEventStore()

  const connect = useCallback(async () => {
    if (!mountedRef.current) return
    // Don't attempt WebSocket if backend is known to be down (#206)
    if (!useHealthStore.getState().alive) return

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${protocol}//${window.location.host}/ws/events`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return }
        retryRef.current = 0
        setConnected(true)
      }
      ws.onclose = () => {
        if (!mountedRef.current) return
        setConnected(false)
        const delay = backoffDelay(retryRef.current)
        console.debug(`[GISPulse] WS closed — reconnecting in ${delay}ms (attempt ${retryRef.current + 1})`)
        retryRef.current++
        timerRef.current = setTimeout(connect, delay)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (msg) => {
        try {
          const event: LiveEvent = JSON.parse(msg.data)
          pushEvent(event)
        } catch {
          // ignore malformed messages
        }
      }
    } catch {
      if (!mountedRef.current) return
      setConnected(false)
      const delay = backoffDelay(retryRef.current)
      retryRef.current++
      timerRef.current = setTimeout(connect, delay)
    }
  }, [setConnected, pushEvent])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect])
}
