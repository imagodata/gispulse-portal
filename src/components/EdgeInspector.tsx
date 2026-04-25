/**
 * EdgeInspector — Inspector panel content for a selected relation edge.
 *
 * Shows relation details, attached trigger, computed fields,
 * and actions to confirm/attach/add-computation.
 */

import { useState, useCallback, useEffect } from "react"
import { Link2, Zap, Activity, Trash2, Plus, CheckCircle, XCircle, Code, ChevronDown, ChevronRight } from "lucide-react"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useRelationStore } from "@/stores/relationStore"
import { useProjectStore } from "@/stores/projectStore"
import { previewSQL } from "@/api/relations"
import type { ComputedField } from "@/api/relations"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h4 className="text-label font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-3 flex items-center gap-1.5">
      {icon}
      {children}
    </h4>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-0.5">
      <span className="text-label-lg text-muted-foreground shrink-0">{label}</span>
      <span className="text-label-lg font-medium text-right break-all">{value}</span>
    </div>
  )
}

function ComputedFieldItem({
  cf,
  onRemove,
}: {
  cf: ComputedField
  relationId: string
  onRemove: (name: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-muted/50 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <Zap size={10} className="text-emerald-500 shrink-0" />
          <span className="text-label-lg font-mono font-medium truncate">{cf.name}</span>
        </div>
        <div className="text-label text-muted-foreground font-mono truncate mt-0.5">
          {cf.agg_function ? `${cf.agg_function}(${cf.source_field ?? "*"})` : cf.expression}
        </div>
        <div className="text-label text-muted-foreground mt-0.5">
          Refresh: {cf.refresh_mode}
          {cf.cron && ` (${cf.cron})`}
        </div>
      </div>
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
        onClick={() => onRemove(cf.name)}
        title="Remove computed field"
      >
        <Trash2 size={12} className="text-destructive" />
      </button>
    </div>
  )
}

// Re-exported from shared component
import { AddComputationForm } from "@/components/AddComputationForm"

// ---------------------------------------------------------------------------
// Main EdgeInspector
// ---------------------------------------------------------------------------

export function EdgeInspector({ relationId }: { relationId: string }) {
  const relations = useRelationStore((s) => s.relations)
  const confirmRelation = useRelationStore((s) => s.confirmRelation)
  const deleteRelation = useRelationStore((s) => s.deleteRelation)
  const detachTrigger = useRelationStore((s) => s.detachTrigger)
  const removeComputation = useRelationStore((s) => s.removeComputation)
  const triggers = useProjectStore((s) => s.triggers)

  const rel = relations.find((r) => r.id === relationId)

  const [sqlPreview, setSqlPreview] = useState<string[] | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [sectionsOpen, setSectionsOpen] = useState({ relation: true, trigger: true, computed: true, sql: false })

  const toggleSection = useCallback((key: keyof typeof sectionsOpen) => {
    setSectionsOpen((s) => ({ ...s, [key]: !s[key] }))
  }, [])

  // Load SQL preview when relation has computed fields
  useEffect(() => {
    if (!rel || rel.computed_fields.length === 0) {
      setSqlPreview(null)
      return
    }
    previewSQL(rel.id).then((r) => setSqlPreview(r.sql_statements)).catch(() => setSqlPreview(null))
  }, [rel?.id, rel?.computed_fields.length])

  if (!rel) {
    return <div className="text-xs text-muted-foreground">Relation not found.</div>
  }

  const attachedTrigger = rel.trigger_id ? triggers.find((t) => t.id === rel.trigger_id) : null
  const level = rel.computed_fields.length > 0 ? "active" : rel.trigger_id ? "reactive" : "passive"

  const handleConfirm = async () => {
    try {
      await confirmRelation(rel.id)
      toast.success("Relation confirmed")
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleDelete = () => setShowDeleteConfirm(true)

  const confirmDeleteRelation = async () => {
    try {
      await deleteRelation(rel.id)
      toast.success("Relation deleted")
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)))
    }
    setShowDeleteConfirm(false)
  }

  const handleDetachTrigger = async () => {
    try {
      await detachTrigger(rel.id)
      toast.success("Trigger detached")
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleRemoveComputation = async (name: string) => {
    try {
      await removeComputation(rel.id, name)
      toast.success(`Removed "${name}"`)
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Link2 size={14} className="text-muted-foreground" />
        <span className="text-sm font-semibold truncate">
          {rel.source_layer_name} {"\u2192"} {rel.target_layer_name}
        </span>
      </div>

      {/* Level badge */}
      <div className="flex items-center gap-2">
        <Badge variant={level === "active" ? "default" : "secondary"} className="text-label">
          {level === "active" && <Zap size={10} className="mr-0.5" />}
          {level === "reactive" && <Activity size={10} className="mr-0.5" />}
          {level}
        </Badge>
        {!rel.confirmed && (
          <Badge variant="outline" className="text-label text-amber-600 border-amber-300">
            unconfirmed
          </Badge>
        )}
        {rel.auto_detected && (
          <Badge variant="outline" className="text-label">auto</Badge>
        )}
      </div>

      <Separator className="my-2" />

      {/* Section: Relation */}
      <button className="w-full flex items-center gap-1 text-left" onClick={() => toggleSection("relation")}>
        {sectionsOpen.relation ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <SectionTitle icon={<Link2 size={10} />}>Relation</SectionTitle>
      </button>
      {sectionsOpen.relation && (
        <div className="pl-4 space-y-0.5">
          <FieldRow label="Type" value={rel.relation_type} />
          {rel.spatial_op && <FieldRow label="Predicate" value={`ST_${rel.spatial_op.charAt(0).toUpperCase() + rel.spatial_op.slice(1)}`} />}
          {rel.source_field && <FieldRow label="Source field" value={rel.source_field} />}
          {rel.target_field && <FieldRow label="Target field" value={rel.target_field} />}
          <FieldRow label="Confidence" value={`${Math.round(rel.confidence * 100)}%`} />
          {rel.spatial_config.buffer_m != null && (
            <FieldRow label="Buffer" value={`${String(rel.spatial_config.buffer_m)}m`} />
          )}
          {rel.spatial_config.distance != null && (
            <FieldRow label="Distance" value={`${String(rel.spatial_config.distance)}m`} />
          )}
        </div>
      )}

      {/* Section: Trigger */}
      <button className="w-full flex items-center gap-1 text-left mt-2" onClick={() => toggleSection("trigger")}>
        {sectionsOpen.trigger ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <SectionTitle icon={<Activity size={10} />}>Trigger</SectionTitle>
      </button>
      {sectionsOpen.trigger && (
        <div className="pl-4">
          {attachedTrigger ? (
            <div className="space-y-1">
              <FieldRow label="Name" value={attachedTrigger.name} />
              <FieldRow label="Event" value={attachedTrigger.event} />
              <FieldRow label="Enabled" value={attachedTrigger.enabled ? "Yes" : "No"} />
              <Button variant="outline" size="sm" className="h-6 text-xs mt-1 w-full" onClick={handleDetachTrigger}>
                Detach trigger
              </Button>
            </div>
          ) : (
            <p className="text-label text-muted-foreground italic">No trigger attached</p>
          )}
        </div>
      )}

      {/* Section: Computed fields */}
      <button className="w-full flex items-center gap-1 text-left mt-2" onClick={() => toggleSection("computed")}>
        {sectionsOpen.computed ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <SectionTitle icon={<Zap size={10} />}>
          Computed Fields ({rel.computed_fields.length})
        </SectionTitle>
      </button>
      {sectionsOpen.computed && (
        <div className="pl-2 space-y-1.5">
          {rel.computed_fields.map((cf) => (
            <ComputedFieldItem
              key={cf.name}
              cf={cf}
              relationId={rel.id}
              onRemove={handleRemoveComputation}
            />
          ))}
          {showAddForm ? (
            <AddComputationForm
              relationId={rel.id}
              onDone={() => setShowAddForm(false)}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs w-full"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={10} className="mr-1" /> Add computation
            </Button>
          )}
        </div>
      )}

      {/* Section: SQL preview */}
      {sqlPreview && sqlPreview.length > 0 && (
        <>
          <button className="w-full flex items-center gap-1 text-left mt-2" onClick={() => toggleSection("sql")}>
            {sectionsOpen.sql ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <SectionTitle icon={<Code size={10} />}>SQL Preview</SectionTitle>
          </button>
          {sectionsOpen.sql && (
            <div className="pl-2">
              {sqlPreview.map((sql, i) => (
                <pre
                  key={i}
                  className="text-label font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all"
                >
                  {sql}
                </pre>
              ))}
            </div>
          )}
        </>
      )}

      <Separator className="my-2" />

      {/* Actions */}
      <div className="flex flex-col gap-1">
        {!rel.confirmed && (
          <Button variant="outline" size="sm" className="h-7 text-xs justify-start" onClick={handleConfirm}>
            <CheckCircle size={12} className="mr-1.5 text-emerald-500" /> Confirm relation
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs justify-start text-destructive hover:text-destructive"
          onClick={handleDelete}
        >
          <XCircle size={12} className="mr-1.5" /> Delete relation
        </Button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete relation?"
        description="Delete this relation? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteRelation}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
