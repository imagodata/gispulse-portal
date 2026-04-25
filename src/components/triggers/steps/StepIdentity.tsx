import { Input } from "@/components/ui/input"
import { ToggleSwitch, LiveEvalFeed } from "../shared"
import type { UseTriggerFormReturn } from "../hooks/useTriggerForm"

interface StepIdentityProps {
  form: UseTriggerFormReturn
}

export function StepIdentity({ form }: StepIdentityProps) {
  const { name, setName, description, setDescription, ruleId, setRuleId, rules,
    autoEval, setAutoEval, isEditing, evalEvents, setEvalEvents } = form

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="step-identity-name" className="text-xs font-medium">
          Name <span className="text-destructive">*</span>
        </label>
        <Input
          id="step-identity-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. On road insert buffer"
          className="text-sm"
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="step-identity-description" className="text-xs font-medium">Description</label>
        <textarea
          id="step-identity-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this trigger do?"
          className="w-full h-20 rounded-md border bg-background px-3 py-2 text-sm resize-y"
        />
      </div>

      {/* Linked Rule */}
      <div className="space-y-1.5">
        <label htmlFor="step-identity-rule" className="text-xs font-medium">Linked Rule</label>
        {rules.length > 0 ? (
          <select
            id="step-identity-rule"
            value={ruleId}
            onChange={(e) => setRuleId(e.target.value)}
            className="w-full h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">None (no linked rule)</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.capability})
              </option>
            ))}
          </select>
        ) : (
          <Input
            id="step-identity-rule"
            value={ruleId}
            onChange={(e) => setRuleId(e.target.value)}
            placeholder="Rule ID (create rules first)"
            className="text-sm"
          />
        )}
      </div>

      {/* Auto-eval toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Auto-eval</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Stream evaluation results in real-time via SSE
          </p>
        </div>
        <ToggleSwitch checked={autoEval} onChange={setAutoEval} />
      </div>

      {autoEval && isEditing && (
        <LiveEvalFeed events={evalEvents} onClear={() => setEvalEvents([])} />
      )}
    </div>
  )
}
