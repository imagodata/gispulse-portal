/**
 * Template store — manages user-saved node graph templates.
 *
 * Templates are serialized graph snapshots (nodes + edges + metadata)
 * that can be loaded into the node editor canvas.
 *
 * Two sources:
 * - Built-in: from workflowTemplates.ts (read-only)
 * - User: saved from canvas, persisted in localStorage
 */

import { create } from "zustand"
import type { Node, Edge } from "@xyflow/react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NodeTemplate {
  id: string
  name: string
  description: string
  domain: "ftth" | "urbanisme" | "environnement" | "transport" | "hydrologie" | "generic" | "custom"
  createdAt: string
  updatedAt: string
  /** Is this a built-in template (read-only)? */
  builtIn?: boolean
  /** Serialized nodes (positions relative to graph origin) */
  nodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data: Record<string, unknown>
  }>
  /** Serialized edges */
  edges: Array<{
    id: string
    source: string
    target: string
    sourceHandle?: string | null
    targetHandle?: string | null
  }>
}

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = "gispulse:userTemplates"

function loadUserTemplates(): NodeTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistUserTemplates(templates: NodeTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

// ---------------------------------------------------------------------------
// Helpers: snapshot current graph → template
// ---------------------------------------------------------------------------

/** Normalize positions so top-left node is at (0, 0) */
function normalizePositions(
  nodes: Array<{ position: { x: number; y: number }; [k: string]: unknown }>,
) {
  if (nodes.length === 0) return nodes
  const minX = Math.min(...nodes.map((n) => n.position.x))
  const minY = Math.min(...nodes.map((n) => n.position.y))
  return nodes.map((n) => ({
    ...n,
    position: { x: n.position.x - minX, y: n.position.y - minY },
  }))
}

export function snapshotToTemplate(
  nodes: Node[],
  edges: Edge[],
  meta: { name: string; description: string; domain: NodeTemplate["domain"] },
): NodeTemplate {
  const now = new Date().toISOString()

  // Strip UI-only fields, keep what matters
  const tplNodes = normalizePositions(
    nodes
      .filter((n) => n.type !== "group")
      .map((n) => {
        const { status, featureCount, ...rest } = n.data as Record<string, unknown>
        return {
          id: n.id,
          type: n.type ?? "capability",
          position: { x: n.position.x, y: n.position.y },
          data: rest,
        }
      }),
  )

  const tplEdges = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
  }))

  return {
    id: `tpl-user-${Date.now()}`,
    name: meta.name,
    description: meta.description,
    domain: meta.domain,
    createdAt: now,
    updatedAt: now,
    nodes: tplNodes as NodeTemplate["nodes"],
    edges: tplEdges,
  }
}

// ---------------------------------------------------------------------------
// Helpers: load template → fresh graph with unique IDs
// ---------------------------------------------------------------------------

let _counter = 0

export function templateToGraph(
  template: NodeTemplate,
  offsetX = 0,
  offsetY = 0,
): { nodes: Node[]; edges: Edge[] } {
  const idMap = new Map<string, string>()
  const ts = Date.now()

  const nodes: Node[] = template.nodes.map((n) => {
    _counter++
    const newId = `node-${ts}-${_counter}`
    idMap.set(n.id, newId)
    return {
      id: newId,
      type: n.type,
      position: { x: n.position.x + offsetX, y: n.position.y + offsetY },
      data: { ...n.data },
    }
  })

  const edges: Edge[] = template.edges.map((e) => {
    _counter++
    return {
      id: `edge-${ts}-${_counter}`,
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    }
  })

  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface TemplateState {
  userTemplates: NodeTemplate[]

  saveTemplate: (template: NodeTemplate) => void
  deleteTemplate: (id: string) => void
  updateTemplate: (id: string, patch: Partial<Pick<NodeTemplate, "name" | "description" | "domain">>) => void
}

export const useTemplateStore = create<TemplateState>((set) => ({
  userTemplates: loadUserTemplates(),

  saveTemplate: (template) =>
    set((s) => {
      const next = [template, ...s.userTemplates]
      persistUserTemplates(next)
      return { userTemplates: next }
    }),

  deleteTemplate: (id) =>
    set((s) => {
      const next = s.userTemplates.filter((t) => t.id !== id)
      persistUserTemplates(next)
      return { userTemplates: next }
    }),

  updateTemplate: (id, patch) =>
    set((s) => {
      const next = s.userTemplates.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
      )
      persistUserTemplates(next)
      return { userTemplates: next }
    }),
}))
