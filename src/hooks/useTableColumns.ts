/**
 * useTableColumns — Resolve column names for a given schema.table.
 *
 * Resolution order:
 * 1. Check loaded datasets in datasetStore (match by layer name)
 * 2. Fallback: SQL introspection via PRAGMA or information_schema
 *
 * Returns { columns, tables, loading } where:
 * - columns: field names for the resolved table
 * - tables:  all available schema.table pairs (for dropdowns)
 * - loading: true while fetching
 */

import { useState, useEffect, useMemo, useRef } from "react"
import { useDatasetStore } from "@/stores/datasetStore"
import { sqlExecute } from "@/api/datasets"
import type { LayerField } from "@/types/dataset"

export interface ColumnInfo {
  name: string
  type: string
}

export interface TableRef {
  schema: string
  table: string
  label: string // "schema.table" display string
}

interface UseTableColumnsResult {
  /** Columns for the specified table */
  columns: ColumnInfo[]
  /** All available tables from loaded datasets */
  tables: TableRef[]
  /** Loading state for SQL introspection fallback */
  loading: boolean
}

/**
 * Get columns for a specific table. Pass schema and table separately.
 * If table is empty, returns empty columns but still provides the tables list.
 */
export function useTableColumns(schema: string, table: string): UseTableColumnsResult {
  const datasets = useDatasetStore((s) => s.datasets)
  const [sqlColumns, setSqlColumns] = useState<ColumnInfo[]>([])
  const [loading, setLoading] = useState(false)
  const prevKey = useRef("")

  // Build available tables list from loaded datasets
  const tables = useMemo<TableRef[]>(() => {
    const refs: TableRef[] = []
    for (const ds of datasets) {
      for (const layer of ds.layers ?? []) {
        // Use dataset name as schema if no explicit schema
        const s = ds.name
        const t = layer.name
        refs.push({ schema: s, table: t, label: `${s}.${t}` })
      }
    }
    return refs
  }, [datasets])

  // Try to resolve columns from dataset store first
  const storeColumns = useMemo<ColumnInfo[] | null>(() => {
    if (!table) return null
    for (const ds of datasets) {
      for (const layer of ds.layers ?? []) {
        // Match by table name (with or without schema prefix)
        if (
          layer.name === table ||
          layer.name === `${schema}.${table}` ||
          (`${ds.name}.${layer.name}` === `${schema}.${table}`)
        ) {
          return (layer.fields ?? []).map((f: LayerField) => ({
            name: f.name,
            type: f.type,
          }))
        }
      }
    }
    return null // not found in store
  }, [datasets, schema, table])

  // SQL introspection fallback
  useEffect(() => {
    const key = `${schema}.${table}`
    if (!table || storeColumns !== null || key === prevKey.current) return
    prevKey.current = key

    let cancelled = false
    setLoading(true)

    const qualifiedTable = schema ? `"${schema}"."${table}"` : `"${table}"`
    // Try PRAGMA first (DuckDB), fall back to information_schema (PostGIS)
    sqlExecute({ sql: `DESCRIBE ${qualifiedTable}`, limit: 200 })
      .then((res) => {
        if (cancelled) return
        // DuckDB DESCRIBE returns columns: column_name, column_type, ...
        const cols = res.rows.map((r) => ({
          name: String(r.column_name ?? r.Field ?? r.name ?? ""),
          type: String(r.column_type ?? r.Type ?? r.type ?? ""),
        })).filter((c) => c.name)
        setSqlColumns(cols)
      })
      .catch(() => {
        // Try information_schema as fallback
        if (cancelled) return
        const whereClause = schema
          ? `table_schema = '${schema}' AND table_name = '${table}'`
          : `table_name = '${table}'`
        sqlExecute({
          sql: `SELECT column_name, data_type FROM information_schema.columns WHERE ${whereClause} ORDER BY ordinal_position`,
          limit: 200,
        })
          .then((res) => {
            if (cancelled) return
            setSqlColumns(
              res.rows.map((r) => ({
                name: String(r.column_name ?? ""),
                type: String(r.data_type ?? ""),
              })).filter((c) => c.name),
            )
          })
          .catch(() => {
            if (!cancelled) setSqlColumns([])
          })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [schema, table, storeColumns])

  return {
    columns: storeColumns ?? sqlColumns,
    tables,
    loading,
  }
}
