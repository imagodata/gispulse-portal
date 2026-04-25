/**
 * TriggerBuilderInline — Sprint R-4, issue #136
 *
 * Inline trigger configuration rendered inside the InspectorPanel when a
 * trigger is selected. Replaces the 6-step modal with collapsible sections:
 *   - Identity (name, severity, category)
 *   - Type (DML / Schedule / Threshold + table/event config)
 *   - Conditions (predicates, count badge)
 *   - Spatial Ops (operations list)
 *   - Actions (action list)
 *   - Review (summary + save)
 *
 * The existing TriggerBuilderModal is preserved as a fallback (accessible via
 * "Open in full editor" button).
 */

import { useState, useCallback } from "react"
import { ChevronDown, ChevronRight, Zap, Save, ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useProjectStore } from "@/stores/projectStore"
import { useEditorStore } from "@/stores/editorStore"
import type { Trigger } from "@/types/project"

// ---------------------------------------------------------------------------
// CollapsibleSection
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string
  badge?: number | string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-1 py-2 text-label-lg font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span className="flex-1 text-left uppercase tracking-wider">{title}</span>
        {badge != null && badge !== 0 && (
          <Badge variant="secondary" className="text-label-sm">{badge}</Badge>
        )}
      </button>
      {open && <div className="pb-2 space-y-1.5">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FieldRow
// ---------------------------------------------------------------------------

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <label className="text-label text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TriggerBuilderInline
// ---------------------------------------------------------------------------

interface TriggerBuilderInlineProps {
  triggerId: string
}

export function TriggerBuilderInline({ triggerId }: TriggerBuilderInlineProps) {
  const triggers = useProjectStore((s) => s.triggers)
  const updateTrigger = useProjectStore((s) => s.updateTrigger)
  const openTriggerBuilder = useEditorStore((s) => s.openTriggerBuilder)

  const trigger: Trigger | undefined = triggers.find((t) => t.id === triggerId)
  const [saving, setSaving] = useState(false)

  // Local editable state (mirrors trigger fields)
  const [name, setName] = useState(trigger?.name ?? "")
  const [severity, setSeverity] = useState(
    (trigger as Record<string, unknown> | undefined)?.severity as string ?? "info"
  )
  const [triggerType, setTriggerType] = useState(trigger?.trigger_type ?? "On DML")
  const [event, setEvent] = useState(trigger?.event ?? "INSERT")
  const [table, setTable] = useState(
    (trigger?.conditions?.table as string) ?? ""
  )
  const [cron, setCron] = useState(
    (trigger?.conditions?.cron as string) ?? ""
  )
  const [threshold, setThreshold] = useState(
    (trigger?.conditions?.threshold as string) ?? ""
  )

  if (!trigger) {
    return <p className="text-xs text-muted-foreground">Trigger not found</p>
  }

  const cond = trigger.conditions ?? {}
  const operations = (cond.operations as unknown[]) ?? []
  const predicates = (cond.predicates as { predicates?: unknown[] } | undefined)
  const actions = (cond.actions as unknown[]) ?? []
  const conditionCount = predicates?.predicates?.length ?? 0

  const isDirty =
    name !== trigger.name ||
    triggerType !== trigger.trigger_type ||
    event !== trigger.event ||
    table !== (cond.table as string ?? "") ||
    severity !== ((trigger as unknown as Record<string, unknown>).severity as string ?? "info")

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Name is required.")
      return
    }
    setSaving(true)
    try {
      await updateTrigger(triggerId, {
        ...trigger,
        name: name.trim(),
        trigger_type: triggerType,
        event,
        conditions: {
          ...trigger.conditions,
          table,
          cron,
          threshold,
        },
      })
      toast.success(`Trigger "${name}" saved`)
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }, [name, triggerType, event, table, cron, threshold, trigger, triggerId, updateTrigger])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Zap size={13} className="text-[var(--gp-node-trigger)] shrink-0" />
        <h3 className="text-sm font-semibold truncate flex-1">{trigger.name}</h3>
        <Badge variant={trigger.enabled ? "default" : "secondary"} className="text-label-sm">
          {trigger.enabled ? "on" : "off"}
        </Badge>
      </div>

      {isDirty && (
        <div className="text-label text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded px-2 py-1 mb-2">
          Unsaved changes
        </div>
      )}

      {/* Inline sections */}
      <div className="border rounded-md overflow-hidden">
        {/* Identity */}
        <CollapsibleSection title="Identity" defaultOpen>
          <div className="px-2 space-y-2">
            <FieldRow label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 text-xs"
                placeholder="Trigger name"
              />
            </FieldRow>
            <FieldRow label="Severity">
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full h-7 rounded border bg-background px-2 text-xs"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </FieldRow>
          </div>
        </CollapsibleSection>

        {/* Type */}
        <CollapsibleSection title="Type">
          <div className="px-2 space-y-2">
            <FieldRow label="Trigger type">
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                className="w-full h-7 rounded border bg-background px-2 text-xs"
              >
                <option value="On DML">On DML</option>
                <option value="On Schedule">On Schedule</option>
                <option value="On Threshold">On Threshold</option>
              </select>
            </FieldRow>
            <FieldRow label="Table">
              <Input
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="h-7 text-xs font-mono"
                placeholder="schema.table"
              />
            </FieldRow>
            {triggerType === "On DML" && (
              <FieldRow label="Event">
                <select
                  value={event}
                  onChange={(e) => setEvent(e.target.value)}
                  className="w-full h-7 rounded border bg-background px-2 text-xs"
                >
                  <option value="INSERT">INSERT</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                  <option value="INSERT,UPDATE">INSERT + UPDATE</option>
                </select>
              </FieldRow>
            )}
            {triggerType === "On Schedule" && (
              <FieldRow label="Cron">
                <Input
                  value={cron}
                  onChange={(e) => setCron(e.target.value)}
                  className="h-7 text-xs font-mono"
                  placeholder="*/5 * * * *"
                />
              </FieldRow>
            )}
            {triggerType === "On Threshold" && (
              <FieldRow label="Expression">
                <Input
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="h-7 text-xs font-mono"
                  placeholder="count > 100"
                />
              </FieldRow>
            )}
          </div>
        </CollapsibleSection>

        {/* Conditions */}
        <CollapsibleSection title="Conditions" badge={conditionCount} defaultOpen={false}>
          <div className="px-2">
            {conditionCount === 0 ? (
              <p className="text-label-lg text-muted-foreground">No conditions. Open full editor to add.</p>
            ) : (
              <div className="space-y-1">
                {(predicates?.predicates as Array<Record<string, unknown>> ?? []).map((p, i) => (
                  <div key={i} className="text-label-lg rounded border px-2 py-1">
                    <span className="text-label-sm font-bold uppercase text-muted-foreground">{String(p.type ?? "?")} </span>
                    {p.type === "attr" && `${String(p.field)} ${String(p.op)} ${String(p.value)}`}
                    {p.type === "geom" && `${String(p.op)} on ${String(p.ref_table ?? "?")}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Spatial Ops */}
        <CollapsibleSection title="Spatial Ops" badge={operations.length} defaultOpen={false}>
          <div className="px-2">
            {operations.length === 0 ? (
              <p className="text-label-lg text-muted-foreground">No spatial operations.</p>
            ) : (
              <div className="space-y-1">
                {(operations as Array<Record<string, unknown>>).map((op, i) => (
                  <div key={i} className="text-label-lg rounded border px-2 py-1">
                    <span className="font-mono">{String(op.operation)}</span>
                    <span className="text-muted-foreground ml-1">({String(op.phase)})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Actions */}
        <CollapsibleSection title="Actions" badge={actions.length} defaultOpen={false}>
          <div className="px-2">
            {actions.length === 0 ? (
              <p className="text-label-lg text-muted-foreground">No actions configured.</p>
            ) : (
              <div className="space-y-1">
                {(actions as Array<Record<string, unknown>>).map((a, i) => (
                  <div key={i} className="text-label-lg rounded border px-2 py-1 font-mono">
                    {String(a.type ?? "?")}
                    {a.target ? <span className="text-muted-foreground ml-1">{"\u2192 "}{String(a.target)}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Review */}
        <CollapsibleSection title="Review" defaultOpen={false}>
          <div className="px-2 space-y-1 text-label-lg">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{triggerType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Table</span>
              <span className="font-mono text-label">{table || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conditions</span>
              <span>{conditionCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Actions</span>
              <span>{actions.length}</span>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* Bottom actions */}
      <div className="flex gap-1.5 mt-3">
        <Button
          size="sm"
          className="h-7 text-xs flex-1 gap-1"
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
          Save
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => openTriggerBuilder(triggerId)}
          title="Open the full stepper editor"
        >
          <ExternalLink size={11} />
          Full editor
        </Button>
      </div>
    </div>
  )
}
