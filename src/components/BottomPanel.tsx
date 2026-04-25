import { useEffect, useRef } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useUIStore, type BottomTab } from "@/stores/uiStore"
import { useLiveEventStore, type StoredLiveEvent } from "@/hooks/useLiveEvents"
import { useResultsStore } from "@/stores/resultsStore"
import { useTriggerHistoryStore } from "@/stores/triggerHistoryStore"
import { TableView } from "./TableView"
import { ResultsPanel } from "./ResultsPanel"
import { TriggerHistoryPanel } from "./TriggerHistoryPanel"
import { SQLConsole } from "./sql/SQLConsole"

const tabs: { value: BottomTab; label: string }[] = [
  { value: "table", label: "Table" },
  { value: "sql", label: "SQL" },
  { value: "results", label: "Results" },
  { value: "triggers", label: "Triggers" },
  { value: "logs", label: "Logs" },
]

const badgeStyles: Record<string, string> = {
  info: "bg-muted text-muted-foreground",
  warn: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  success: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
}

function formatTime(raw: string): string {
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return raw
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  } catch {
    return raw
  }
}

function LogsPanel() {
  const events = useLiveEventStore((s) => s.events)
  const connected = useLiveEventStore((s) => s.connected)
  const clearEvents = useLiveEventStore((s) => s.clearEvents)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-2 py-0.5 border-b">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? "bg-green-500" : "bg-red-500"
            }`}
            aria-hidden="true"
            title={connected ? "WebSocket connected" : "WebSocket disconnected"}
          />
          <span className="text-label text-muted-foreground">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <button
          onClick={clearEvents}
          className="text-label text-muted-foreground hover:text-foreground"
          aria-label="Clear event log"
        >
          Clear
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-2" role="log" aria-live="polite" aria-label="WebSocket event log">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No events yet. Waiting for WebSocket connection...
          </p>
        ) : (
          <div className="space-y-0.5 font-mono text-label-lg">
            {(events as StoredLiveEvent[]).map((evt) => (
              <div key={evt._seq} className="flex items-center gap-2">
                <span className="text-muted-foreground/60 shrink-0 tabular-nums">
                  {formatTime(evt.timestamp)}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-label font-medium leading-none ${
                    badgeStyles[evt.type] ?? badgeStyles.info
                  }`}
                >
                  {evt.type}
                </span>
                <span className="text-foreground truncate">
                  {typeof evt.data === "object" ? JSON.stringify(evt.data) : String(evt.data)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function BottomPanel() {
  const { bottomTab, setBottomTab, bottomPanelOpen } = useUIStore()
  const runningCount = useResultsStore((s) => s.results.filter((r) => r.status === "running").length)
  // Only badge matched trigger events, not all (#213)
  const triggerMatchedCount = useTriggerHistoryStore((s) => s.events.filter((e) => e.matched).length)

  if (!bottomPanelOpen) return null

  return (
    <div className="flex h-full flex-col border-t">
      <Tabs
        value={bottomTab}
        onValueChange={(v) => setBottomTab(v as BottomTab)}
        className="flex flex-col h-full"
      >
        <div className="flex items-center border-b px-2">
          <TabsList className="h-7">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs px-3 h-6 gap-1">
                {t.label}
                {t.value === "results" && runningCount > 0 && (
                  <span className="h-4 min-w-[16px] rounded-full bg-blue-500 text-white text-label-sm font-medium flex items-center justify-center px-1">
                    {runningCount}
                  </span>
                )}
                {t.value === "triggers" && triggerMatchedCount > 0 && (
                  <span className="h-4 min-w-[16px] rounded-full bg-green-500/20 text-green-600 text-label-sm font-medium flex items-center justify-center px-1">
                    {triggerMatchedCount}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="table" className="flex-1 m-0 overflow-hidden">
          <TableView compact />
        </TabsContent>

        <TabsContent value="sql" className="flex-1 m-0 overflow-hidden">
          <SQLConsole />
        </TabsContent>

        <TabsContent value="results" className="flex-1 m-0 overflow-hidden">
          <ResultsPanel />
        </TabsContent>

        <TabsContent value="triggers" className="flex-1 m-0 overflow-hidden">
          <TriggerHistoryPanel />
        </TabsContent>

        <TabsContent value="logs" className="flex-1 m-0">
          <LogsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
