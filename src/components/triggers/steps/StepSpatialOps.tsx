import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Map } from "lucide-react"
import { OperationCard } from "../spatial/OperationCard"
import { emptyOperation } from "../constants"
import type { UseTriggerFormReturn } from "../hooks/useTriggerForm"

interface StepSpatialOpsProps {
  form: UseTriggerFormReturn
}

export function StepSpatialOps({ form }: StepSpatialOpsProps) {
  const { operations, setOperations, allLayers } = form
  const beforeCount = operations.filter((o) => o.phase === "before").length
  const afterCount = operations.filter((o) => o.phase === "after").length

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Map className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Spatial Operations</h3>
          <Badge variant="secondary" className="text-label">
            {operations.length} op{operations.length !== 1 ? "s" : ""}
          </Badge>
          {operations.length > 0 && (
            <span className="text-label text-muted-foreground">
              ({beforeCount} before, {afterCount} after)
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Declarative PostGIS rules chained on DML events. BEFORE = compute on current row, AFTER = propagate to distant table.
        </p>
      </div>

      {operations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-lg border border-dashed bg-muted/20">
          <Map className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground font-medium">No spatial operations</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Add operations to compute fields or propagate aggregations on DML events.</p>
        </div>
      )}

      <div className="space-y-3">
        {operations.map((op, idx) => (
          <OperationCard
            key={idx}
            op={op}
            index={idx}
            layers={allLayers}
            onChange={(updated) => {
              const next = [...operations]
              next[idx] = updated
              setOperations(next)
            }}
            onRemove={() => setOperations(operations.filter((_, i) => i !== idx))}
          />
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-9 text-xs w-full"
        onClick={() => setOperations([...operations, emptyOperation()])}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add spatial operation
      </Button>
    </div>
  )
}
