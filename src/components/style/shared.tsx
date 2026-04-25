/**
 * shared.tsx — Reusable micro-components for the style editor.
 */

import { HexColorPicker } from "react-colorful"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

// ── Color swatch with inline picker ──────────────────────────────────

const PRESETS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
  "#000000", "#ffffff",
]

export function ColorInput({ value, onChange, label }: { value: string; onChange: (c: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1.5">
        {label && <span className="text-label text-muted-foreground w-14 shrink-0">{label}</span>}
        <button
          onClick={() => setOpen(!open)}
          className="h-5 w-5 rounded border border-border hover:ring-2 hover:ring-ring/30 transition-all shrink-0"
          style={{ backgroundColor: value }}
          aria-label={`Pick color: ${value}`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v)
          }}
          className="flex-1 text-xs font-mono bg-transparent border-b border-border outline-none px-0.5 py-0.5 min-w-0"
          maxLength={7}
        />
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 rounded-lg border bg-popover p-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <HexColorPicker color={value} onChange={onChange} style={{ width: 160, height: 100 }} />
          <div className="grid grid-cols-6 gap-1 mt-1.5">
            {PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => onChange(c)}
                className={cn(
                  "h-4 w-4 rounded-full border transition-all",
                  value === c ? "ring-2 ring-ring ring-offset-1" : "border-border hover:scale-110",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Numeric slider with label ─────────────────────────────────────────

export function SliderInput({
  label, value, min, max, step = 1, unit = "", onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-label text-muted-foreground w-14 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 accent-primary"
      />
      <span className="text-label font-mono text-muted-foreground w-10 text-right tabular-nums">
        {Number.isInteger(step) ? value : value.toFixed(1)}{unit}
      </span>
    </div>
  )
}

// ── Select dropdown ───────────────────────────────────────────────────

export function SelectInput<T extends string>({
  label, value, options, onChange,
}: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-label text-muted-foreground w-14 shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="flex-1 h-6 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── Mini color swatch with popover picker (for category/rule tables) ──

export function SwatchPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="h-3.5 w-3.5 rounded-sm border border-border shrink-0 hover:ring-1 hover:ring-ring/30 transition-all"
        style={{ backgroundColor: color }}
        title={`Color: ${color}`}
      />
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 rounded-lg border bg-popover p-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <HexColorPicker color={color} onChange={onChange} style={{ width: 140, height: 90 }} />
          <div className="grid grid-cols-6 gap-1 mt-1.5">
            {PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => { onChange(c); setOpen(false) }}
                className={cn(
                  "h-3.5 w-3.5 rounded-full border transition-all",
                  color === c ? "ring-1 ring-ring ring-offset-1" : "border-border hover:scale-110",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────

export function StyleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-label-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</div>
      <div className="space-y-1.5 pl-0.5">{children}</div>
    </div>
  )
}
