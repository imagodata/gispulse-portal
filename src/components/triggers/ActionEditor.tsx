import { useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Trash2 } from "lucide-react"
import type { TriggerAction } from "@/types/editor"
import { ACTION_TYPES } from "./constants"

interface ActionEditorProps {
  action: TriggerAction
  onChange: (action: TriggerAction) => void
  onRemove: () => void
}

export function ActionEditor({ action, onChange, onRemove }: ActionEditorProps) {
  const updateConfig = useCallback(
    (key: string, value: unknown) => {
      onChange({ ...action, config: { ...action.config, [key]: value } })
    },
    [action, onChange],
  )

  const actionDef = ACTION_TYPES.find((a) => a.value === action.type)

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-label font-semibold">
          {actionDef?.label ?? action.type}
        </Badge>
        <span className="text-label-sm text-muted-foreground capitalize">{actionDef?.category}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onRemove}
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="Remove action"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {action.type === "notify" && (
        <div className="space-y-1.5">
          <Input value={(action.config.message as string) ?? ""} onChange={(e) => updateConfig("message", e.target.value)} placeholder="Notification message" className="text-sm" />
          <Input value={(action.config.channel as string) ?? ""} onChange={(e) => updateConfig("channel", e.target.value)} placeholder="Channel (optional)" className="text-sm" />
        </div>
      )}

      {action.type === "set_field" && (
        <div className="flex gap-2">
          <Input value={(action.config.field as string) ?? ""} onChange={(e) => updateConfig("field", e.target.value)} placeholder="Field name" className="text-sm flex-1" />
          <Input value={(action.config.value as string) ?? ""} onChange={(e) => updateConfig("value", e.target.value)} placeholder="Value" className="text-sm flex-1" />
        </div>
      )}

      {action.type === "flag_feature" && (
        <div className="flex gap-2">
          <Input value={(action.config.flag_field as string) ?? ""} onChange={(e) => updateConfig("flag_field", e.target.value)} placeholder="Flag field name" className="text-sm flex-1" />
          <select value={(action.config.flag_value as string) ?? "violation"} onChange={(e) => updateConfig("flag_value", e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm flex-1">
            <option value="violation">Violation</option>
            <option value="warning">Warning</option>
            <option value="review">Needs Review</option>
          </select>
        </div>
      )}

      {action.type === "run_job" && (
        <div className="space-y-1.5">
          <Input value={(action.config.job_name as string) ?? ""} onChange={(e) => updateConfig("job_name", e.target.value)} placeholder="Job name / capability" className="text-sm" />
          <Input value={(action.config.dataset_id as string) ?? ""} onChange={(e) => updateConfig("dataset_id", e.target.value)} placeholder="Dataset ID (optional)" className="text-sm" />
        </div>
      )}

      {action.type === "run_graph" && (
        <Input value={(action.config.scenario_id as string) ?? ""} onChange={(e) => updateConfig("scenario_id", e.target.value)} placeholder="Scenario ID" className="text-sm" />
      )}

      {action.type === "run_sql" && (
        <textarea
          value={(action.config.sql as string) ?? ""}
          onChange={(e) => updateConfig("sql", e.target.value)}
          placeholder="SELECT ... or UPDATE ..."
          className="w-full h-20 rounded-md border bg-background px-3 py-2 text-sm font-mono resize-y"
        />
      )}

      {action.type === "webhook" && (
        <div className="space-y-1.5">
          <Input value={(action.config.url as string) ?? ""} onChange={(e) => updateConfig("url", e.target.value)} placeholder="https://example.com/hook" className="text-sm" />
          <select value={(action.config.method as string) ?? "POST"} onChange={(e) => updateConfig("method", e.target.value)} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
          </select>
        </div>
      )}

      {action.type === "log_event" && (
        <Input value={(action.config.message as string) ?? ""} onChange={(e) => updateConfig("message", e.target.value)} placeholder="Log message template" className="text-sm" />
      )}

      {action.type === "send_email" && (
        <div className="space-y-1.5">
          <Input value={(action.config.to as string) ?? ""} onChange={(e) => updateConfig("to", e.target.value)} placeholder="recipient@example.com" className="text-sm" />
          <Input value={(action.config.subject as string) ?? ""} onChange={(e) => updateConfig("subject", e.target.value)} placeholder="Subject" className="text-sm" />
          <Input value={(action.config.body as string) ?? ""} onChange={(e) => updateConfig("body", e.target.value)} placeholder="Body template" className="text-sm" />
        </div>
      )}

      {(action.type === "approve" || action.type === "reject") && (
        <Input value={(action.config.reason as string) ?? ""} onChange={(e) => updateConfig("reason", e.target.value)} placeholder="Reason / comment" className="text-sm" />
      )}

      {action.type === "block_commit" && (
        <Input value={(action.config.message as string) ?? ""} onChange={(e) => updateConfig("message", e.target.value)} placeholder="Block message shown to user" className="text-sm" />
      )}

      {action.type === "update_aggregate" && (
        <div className="space-y-1.5">
          <Input value={(action.config.target_table as string) ?? ""} onChange={(e) => updateConfig("target_table", e.target.value)} placeholder="Target table" className="text-sm" />
          <Input value={(action.config.aggregate_field as string) ?? ""} onChange={(e) => updateConfig("aggregate_field", e.target.value)} placeholder="Aggregate field" className="text-sm" />
          <select value={(action.config.aggregate_fn as string) ?? "count"} onChange={(e) => updateConfig("aggregate_fn", e.target.value)} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
            <option value="count">COUNT</option>
            <option value="sum">SUM</option>
            <option value="avg">AVG</option>
            <option value="min">MIN</option>
            <option value="max">MAX</option>
          </select>
        </div>
      )}

      {action.type === "enqueue" && (
        <div className="space-y-1.5">
          <Input value={(action.config.queue as string) ?? ""} onChange={(e) => updateConfig("queue", e.target.value)} placeholder="Queue name" className="text-sm" />
          <Input value={(action.config.payload_template as string) ?? ""} onChange={(e) => updateConfig("payload_template", e.target.value)} placeholder="Payload template (JSON)" className="text-sm" />
        </div>
      )}
    </div>
  )
}
