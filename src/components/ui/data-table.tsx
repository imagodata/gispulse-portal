/**
 * components/ui/data-table.tsx — Composant DataTable réutilisable.
 *
 * Props: columns, data, pagination, sorting, search, row actions.
 * Pas de dépendance externe supplémentaire — implémentation native
 * avec les primitives @base-ui/react et Tailwind.
 *
 * Accessible WCAG 2.1 AA : navigation clavier, rôles ARIA, focus visible.
 */

import { useState, useMemo, useCallback, type ReactNode } from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortDirection = "asc" | "desc" | null

export interface ColumnDef<T> {
  /** Unique key for this column */
  key: string
  /** Header label */
  header: string
  /** Accessor function or property key */
  accessor: keyof T | ((row: T) => ReactNode)
  /** Enable sorting on this column (requires accessor to return primitive) */
  sortable?: boolean
  /** Column width class (Tailwind w-*) */
  width?: string
  /** Alignment */
  align?: "left" | "center" | "right"
}

export interface DataTableProps<T extends { id: string }> {
  columns: ColumnDef<T>[]
  data: T[]
  /** Loading skeleton */
  loading?: boolean
  /** Empty state message */
  emptyMessage?: string
  /** Client-side search — searches all string values if enabled */
  searchable?: boolean
  searchPlaceholder?: string
  /** Pagination — if total is provided, assumes server-side */
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
  }
  /** Row actions rendered in last column */
  rowActions?: (row: T) => ReactNode
  /** Row click handler */
  onRowClick?: (row: T) => void
  /** Optional toolbar slot (rendered right of search) */
  toolbar?: ReactNode
  className?: string
}

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === "asc") return <ChevronUp size={12} className="shrink-0" />
  if (direction === "desc") return <ChevronDown size={12} className="shrink-0" />
  return <ChevronsUpDown size={12} className="shrink-0 opacity-40" />
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-3.5 rounded bg-muted animate-pulse" style={{ width: `${60 + (i * 13) % 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  emptyMessage = "No results.",
  searchable = false,
  searchPlaceholder = "Search...",
  pagination,
  rowActions,
  onRowClick,
  toolbar,
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)

  // Client-side filter
  const filtered = useMemo(() => {
    if (!searchable || !search.trim()) return data
    const q = search.trim().toLowerCase()
    return data.filter((row) =>
      Object.values(row as Record<string, unknown>).some((v) =>
        v !== null && v !== undefined && String(v).toLowerCase().includes(q)
      )
    )
  }, [data, search, searchable])

  // Client-side sort (only when no server pagination)
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir || pagination) return filtered
    return [...filtered].sort((a, b) => {
      const col = columns.find((c) => c.key === sortKey)
      if (!col) return 0
      const av = typeof col.accessor === "function" ? null : (a as Record<string, unknown>)[col.accessor as string]
      const bv = typeof col.accessor === "function" ? null : (b as Record<string, unknown>)[col.accessor as string]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir, pagination, columns])

  const handleSort = useCallback(
    (key: string) => {
      setSortKey((prev) => {
        if (prev === key) {
          setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"))
          return key
        }
        setSortDir("asc")
        return key
      })
    },
    []
  )

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1
  const displayedFrom = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 1
  const displayedTo = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : sorted.length
  const displayedTotal = pagination ? pagination.total : sorted.length

  const colCount = columns.length + (rowActions ? 1 : 0)

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Toolbar row */}
      {(searchable || toolbar) && (
        <div className="flex items-center gap-2">
          {searchable && (
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8 h-7 text-xs"
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {toolbar && <div className="flex items-center gap-2 ml-auto">{toolbar}</div>}
        </div>
      )}

      {/* Table container */}
      <div className="relative overflow-x-auto rounded-lg border border-border">
        <table
          className="w-full text-xs"
          role="grid"
          aria-rowcount={displayedTotal}
          aria-colcount={colCount}
        >
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-3 py-2 text-left font-medium text-muted-foreground select-none",
                    col.width,
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                    col.sortable && "cursor-pointer hover:text-foreground hover:bg-muted transition-colors"
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  onKeyDown={
                    col.sortable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            handleSort(col.key)
                          }
                        }
                      : undefined
                  }
                  tabIndex={col.sortable ? 0 : undefined}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === "asc"
                        ? "ascending"
                        : sortDir === "desc"
                        ? "descending"
                        : "none"
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <SortIcon direction={sortKey === col.key ? sortDir : null} />
                    )}
                  </span>
                </th>
              ))}
              {rowActions && (
                <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground w-20">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-muted/40 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter") onRowClick(row)
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                >
                  {columns.map((col) => {
                    const value =
                      typeof col.accessor === "function"
                        ? col.accessor(row)
                        : (row as Record<string, unknown>)[col.accessor as string] as ReactNode
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-3 py-2.5 text-foreground/90",
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right"
                        )}
                      >
                        {value}
                      </td>
                    )
                  })}
                  {rowActions && (
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {rowActions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {displayedTotal === 0
              ? "No results"
              : `${displayedFrom}–${displayedTo} of ${displayedTotal}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={12} />
            </Button>
            <span className="px-2 tabular-nums">
              {pagination.page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight size={12} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
