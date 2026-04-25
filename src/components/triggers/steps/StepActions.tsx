import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Zap } from "lucide-react"
import { ActionEditor } from "../ActionEditor"
import { ACTION_TYPES } from "../constants"
import type { UseTriggerFormReturn } from "../hooks/useTriggerForm"

interface StepActionsProps {
  form: UseTriggerFormReturn
}

export function StepActions({ form }: StepActionsProps) {
  const { actions, setActions } = form
  const actionCount = actions.length

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Actions</h3>
          <Badge variant="secondary" className="text-label">
            {actionCount}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Operations to perform when the trigger fires.
        </p>
      </div>

      {actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((action, idx) => (
            <ActionEditor
              key={idx}
              action={action}
              onChange={(a) => {
                const next = [...actions]
                next[idx] = a
                setActions(next)
              }}
              onRemove={() => setActions(actions.filter((_, i) => i !== idx))}
            />
          ))}
        </div>
      )}

      {actions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-lg border border-dashed bg-muted/20">
          <Zap className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground font-medium">No actions configured</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Add actions below to respond when this trigger fires.</p>
        </div>
      )}

      {/* Add action buttons by category */}
      <div className="space-y-3 pt-2">
        {["notification", "mutation", "execution", "workflow", "external"].map((cat) => {
          const catActions = ACTION_TYPES.filter((a) => a.category === cat)
          if (catActions.length === 0) return null
          return (
            <div key={cat}>
              <p className="text-label font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">{cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {catActions.map((at) => (
                  <Button
                    key={at.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-label-lg"
                    disabled={at.disabled}
                    onClick={() => setActions([...actions, { type: at.value, config: {} }])}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {at.label}
                  </Button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
