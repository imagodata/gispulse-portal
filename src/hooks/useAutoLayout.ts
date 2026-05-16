/**
 * useAutoLayout — Auto-layout DAG using dagre.
 *
 * Sprint W2: provides a function to reorganize node positions
 * using the dagre library for a clean top-to-bottom or left-to-right layout.
 */

import { useCallback } from "react"
import Dagre from "@dagrejs/dagre"
import type { Node, Edge } from "@xyflow/react"

export type LayoutDirection = "TB" | "LR"

const DEFAULT_NODE_WIDTH = 180
const DEFAULT_NODE_HEIGHT = 60

export function useAutoLayout() {
  const autoLayout = useCallback(
    (
      nodes: Node[],
      edges: Edge[],
      direction: LayoutDirection = "TB",
    ): { nodes: Node[]; edges: Edge[] } => {
      const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))

      g.setGraph({
        rankdir: direction,
        nodesep: 60,
        ranksep: 80,
        marginx: 40,
        marginy: 40,
      })

      // Skip group nodes for layout (they are containers)
      const layoutNodes = nodes.filter((n) => n.type !== "group")

      for (const node of layoutNodes) {
        const w = (node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH) as number
        const h = (node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT) as number
        g.setNode(node.id, { width: w, height: h })
      }

      for (const edge of edges) {
        g.setEdge(edge.source, edge.target)
      }

      Dagre.layout(g)

      const updatedNodes = nodes.map((node) => {
        if (node.type === "group") return node

        const pos = g.node(node.id)
        if (!pos) return node

        const w = (node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH) as number
        const h = (node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT) as number

        return {
          ...node,
          position: {
            x: pos.x - w / 2,
            y: pos.y - h / 2,
          },
        }
      })

      return { nodes: [...updatedNodes], edges: [...edges] }
    },
    [],
  )

  return { autoLayout }
}
