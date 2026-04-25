/**
 * stores/relationStore.ts — Zustand store for TableRelation state.
 *
 * Hybrid Schema: manages persisted relations between layers,
 * synced with the /relations API.
 */

import { create } from "zustand"
import type { TableRelation } from "@/api/relations"
import {
  listRelations,
  createRelation as apiCreate,
  updateRelation as apiUpdate,
  deleteRelation as apiDelete,
  confirmRelation as apiConfirm,
  attachTrigger as apiAttachTrigger,
  detachTrigger as apiDetachTrigger,
  addComputation as apiAddComputation,
  removeComputation as apiRemoveComputation,
  type RelationCreate,
} from "@/api/relations"

interface RelationState {
  relations: TableRelation[]
  loading: boolean
  error: string | null

  // CRUD
  fetchRelations: () => Promise<void>
  createRelation: (data: RelationCreate) => Promise<TableRelation>
  updateRelation: (id: string, data: Partial<RelationCreate>) => Promise<void>
  deleteRelation: (id: string) => Promise<void>

  // Actions
  confirmRelation: (id: string) => Promise<void>
  ignoreRelation: (id: string) => Promise<void>
  attachTrigger: (id: string, triggerId: string) => Promise<void>
  detachTrigger: (id: string) => Promise<void>
  addComputation: (id: string, data: {
    name: string
    expression: string
    target_field?: string
    agg_function?: string | null
    source_field?: string | null
    refresh_mode?: string
  }) => Promise<void>
  removeComputation: (id: string, fieldName: string) => Promise<void>

  // Local helpers
  _upsert: (rel: TableRelation) => void
}

export const useRelationStore = create<RelationState>((set, get) => ({
  relations: [],
  loading: false,
  error: null,

  _upsert: (rel) =>
    set((s) => {
      const idx = s.relations.findIndex((r) => r.id === rel.id)
      const next = [...s.relations]
      if (idx >= 0) next[idx] = rel
      else next.push(rel)
      return { relations: next }
    }),

  fetchRelations: async () => {
    set({ loading: true, error: null })
    try {
      const rels = await listRelations()
      set({ relations: rels, loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  createRelation: async (data) => {
    const rel = await apiCreate(data)
    get()._upsert(rel)
    return rel
  },

  updateRelation: async (id, data) => {
    const rel = await apiUpdate(id, data)
    get()._upsert(rel)
  },

  deleteRelation: async (id) => {
    await apiDelete(id)
    set((s) => ({ relations: s.relations.filter((r) => r.id !== id) }))
  },

  confirmRelation: async (id) => {
    const rel = await apiConfirm(id)
    get()._upsert(rel)
  },

  ignoreRelation: async (id) => {
    await apiDelete(id)
    set((s) => ({ relations: s.relations.filter((r) => r.id !== id) }))
  },

  attachTrigger: async (id, triggerId) => {
    const rel = await apiAttachTrigger(id, triggerId)
    get()._upsert(rel)
  },

  detachTrigger: async (id) => {
    const rel = await apiDetachTrigger(id)
    get()._upsert(rel)
  },

  addComputation: async (id, data) => {
    const rel = await apiAddComputation(id, data)
    get()._upsert(rel)
  },

  removeComputation: async (id, fieldName) => {
    const rel = await apiRemoveComputation(id, fieldName)
    get()._upsert(rel)
  },
}))
