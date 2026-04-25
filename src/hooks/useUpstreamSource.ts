/**
 * useUpstreamSource — Walk backward through React Flow edges to find
 * the connected TableSource node for any operation node.
 *
 * Returns { schema, table, event } from the upstream TableSourceData,
 * or null if no source is connected yet.
 */

import { useMemo } from "react"
import { useReactFlow } from "@xyflow/react"
import type { TableSourceData } from "@/components/nodes/ops/types"

export interface UpstreamSource {
  nodeId: string
  schema: string
  table: string
  event: string
  geometryColumn?: string
}

export function useUpstreamSource(nodeId: string): UpstreamSource | null {
  const { getNodes, getEdges } = useReactFlow()
  const nodes = getNodes()
  const edges = getEdges()

  return useMemo(() => {
    const visited = new Set<string>()
    const queue = [nodeId]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      const node = nodes.find((n) => n.id === current)
      if (!node) continue
      const d = node.data as Record<string, unknown>
      if (d.nodeKind === "tableSource") {
        const src = d as unknown as TableSourceData
        return {
          nodeId: node.id,
          schema: src.schema,
          table: src.table,
          event: src.event,
          geometryColumn: src.geometryColumn,
        }
      }
      for (const edge of edges) {
        if (edge.target === current) queue.push(edge.source)
      }
    }
    return null
  }, [nodeId, nodes, edges])
}
