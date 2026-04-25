/**
 * SQLPreviewTable — lightweight table for SQL preview results.
 *
 * Renders dynamic columns with max N rows. Null values displayed
 * in italic grey. Scrollable both horizontally and vertically.
 */

interface SQLPreviewTableProps {
  columns: string[]
  rows: Record<string, unknown>[]
  maxHeight?: number
}

export function SQLPreviewTable({
  columns,
  rows,
  maxHeight = 240,
}: SQLPreviewTableProps) {
  if (columns.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-2">
        No columns returned.
      </div>
    )
  }

  return (
    <div
      className="overflow-auto border border-border rounded"
      style={{ maxHeight }}
    >
      <table className="w-full text-xs font-mono border-collapse">
        <thead>
          <tr className="bg-muted/60 sticky top-0">
            {columns.map((col) => (
              <th
                key={col}
                className="text-left px-2 py-1 border-b border-border font-semibold text-foreground whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-2 py-3 text-center text-muted-foreground italic"
              >
                No rows returned.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                {columns.map((col) => {
                  const val = row[col]
                  const isNull = val === null || val === undefined
                  return (
                    <td
                      key={col}
                      className={`px-2 py-1 whitespace-nowrap ${
                        isNull
                          ? "text-muted-foreground italic"
                          : "text-foreground"
                      }`}
                    >
                      {isNull ? "null" : String(val)}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
