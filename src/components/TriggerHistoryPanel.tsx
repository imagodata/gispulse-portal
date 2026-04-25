import { useEffect, useRef, useState } from "react"
import { useTriggerHistoryStore, type TriggerFireEvent } from "@/stores/triggerHistoryStore"
import { useLiveEventStore } from "@/hooks/useLiveEvents"
import { useProjectStore } from "@/stores/projectStore"
import { Badge } from "@/components/ui/badge"
import { Search, Trash2, Zap, ZapOff } from "lucide-react"

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return iso
  }
}

function TriggerEventRow({ event }: { event: TriggerFireEvent }) {
  return (
    <div className={`flex items-center gap-2 rounded px-2 py-1 text-label-lg ${
      event.matched ? "bg-green-500/10" : "bg-muted"
    }`}>
      {event.matched ? (
        <Zap size={12} className="shrink-0 text-green-500" />
      ) : (
        <ZapOff size={12} className="shrink-0 text-muted-foreground/40" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate">{event.triggerName}</span>
          {event.operation && (
            <Badge variant="secondary" className="text-label-sm">{event.operation}</Badge>
          )}
          {event.table && (
            <span className="text-muted-foreground/60 truncate">{event.table}</span>
          )}
        </div>
        {event.actionsDispatched.length > 0 && (
          <div className="flex gap-1 mt-0.5">
            {event.actionsDispatched.map((a, i) => (
              <Badge key={i} variant="outline" className="text-label-xs">{a}</Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-label text-muted-foreground/60">{formatTime(event.firedAt)}</span>
        <span className="text-label-sm text-muted-foreground/40">{event.evalTimeMs.toFixed(1)}ms</span>
      </div>
    </div>
  )
}

export function TriggerHistoryPanel() {
  const events = useTriggerHistoryStore((s) => s.events)
  const pushEvent = useTriggerHistoryStore((s) => s.pushEvent)
  const clearEvents = useTriggerHistoryStore((s) => s.clearEvents)
  const liveEvents = useLiveEventStore((s) => s.events)
  const triggers = useProjectStore((s) => s.triggers)
  const [filter, setFilter] = useState("")
  const lastProcessed = useRef(0)

  // Convert WebSocket live events of type "trigger_fired" to TriggerFireEvents.
  // Reset lastProcessed when liveEvents array is cleared (length drops to 0).
  useEffect(() => {
    if (liveEvents.length === 0) {
      lastProcessed.current = 0
      return
    }
    if (liveEvents.length <= lastProcessed.current) return
    const newEvents = liveEvents.slice(lastProcessed.current)
    lastProcessed.current = liveEvents.length

    for (const evt of newEvents) {
      if (evt.type !== "trigger_fired") continue
      const data = evt.data as Record<string, unknown>
      const triggerId = (data.trigger_id as string) ?? ""
      const trigger = triggers.find((t) => t.id === triggerId)
      pushEvent({
        id: `tf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        triggerId,
        triggerName: trigger?.name ?? triggerId.slice(0, 8),
        matched: (data.matched as boolean) ?? false,
        operation: (data.result_summary as Record<string, string>)?.operation,
        table: (data.result_summary as Record<string, string>)?.table,
        evalTimeMs: (data.eval_time_ms as number) ?? 0,
        actionsDispatched: (data.actions_dispatched as string[]) ?? [],
        cascadeDepth: (data.cascade_depth as number) ?? 0,
        firedAt: evt.timestamp,
      })
    }
  }, [liveEvents.length, triggers, pushEvent])

  const filtered = filter
    ? events.filter((e) => e.triggerName.toLowerCase().includes(filter.toLowerCase()) || (e.table ?? "").toLowerCase().includes(filter.toLowerCase()))
    : events

  const matchedCount = events.filter((e) => e.matched).length
  const totalCount = events.length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-2 py-0.5 border-b gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-label text-muted-foreground">
            {matchedCount}/{totalCount} matched
          </span>
        </div>
        <div className="flex items-center gap-1 flex-1 max-w-xs">
          <Search size={10} className="text-muted-foreground/60 shrink-0" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter triggers..."
            className="flex-1 bg-transparent text-label outline-none placeholder:text-muted-foreground/40"
          />
        </div>
        {events.length > 0 && (
          <button onClick={clearEvents} className="text-label text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0">
            <Trash2 size={10} /> Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Zap size={24} className="text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">No trigger events yet.</p>
            <p className="text-label text-muted-foreground/60 mt-1">
              Events will appear here when triggers fire via DML changes or scheduled evaluations.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((e) => (
              <TriggerEventRow key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
