import { Badge } from "@/components/ui/badge"
import { Filter } from "lucide-react"
import { PredicateBuilder } from "../PredicateBuilder"
import type { UseTriggerFormReturn } from "../hooks/useTriggerForm"

interface StepConditionsProps {
  form: UseTriggerFormReturn
}

export function StepConditions({ form }: StepConditionsProps) {
  const { predicates, setPredicates, allFields, allLayers } = form
  const conditionCount = predicates.predicates.length

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Conditions</h3>
          <Badge variant="secondary" className="text-label">
            {conditionCount} rule{conditionCount !== 1 ? "s" : ""}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Attribute and geometry predicates that must be satisfied for the trigger to fire.
        </p>
      </div>
      <PredicateBuilder
        value={predicates}
        onChange={setPredicates}
        fields={allFields}
        tables={allLayers}
      />
    </div>
  )
}
