/**
 * NodeEditorContextMenu — Right-click context menus for the node editor.
 *
 * Sprint W1: Canvas menu (add node, paste, zoom fit) and Node menu
 * (duplicate, delete, disconnect, run this node).
 */

import { useEffect, useRef, useCallback } from "react"
import {
  Copy,
  Trash2,
  Scissors,
  ZoomIn,
  ClipboardPaste,
  Play,
  Plus,
  Unlink,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextMenuPosition {
  x: number
  y: number
}

export interface CanvasContextMenuProps {
  position: ContextMenuPosition
  onClose: () => void
  onPaste: () => void
  onZoomFit: () => void
  onSelectAll: () => void
}

export interface NodeContextMenuProps {
  position: ContextMenuPosition
  nodeId: string
  nodeLabel: string
  onClose: () => void
  onDuplicate: () => void
  onDelete: () => void
  onDisconnect: () => void
  onCopy: () => void
  onRunNode?: () => void
}

export interface EdgeContextMenuProps {
  position: ContextMenuPosition
  edgeId: string
  onClose: () => void
  onDelete: () => void
}

// ---------------------------------------------------------------------------
// Shared wrapper
// ---------------------------------------------------------------------------

function MenuWrapper({
  position,
  onClose,
  children,
}: {
  position: ContextMenuPosition
  onClose: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", keyHandler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", keyHandler)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Context menu"
      className="fixed z-[100] min-w-[160px] rounded-md border border-border bg-background shadow-xl py-1 animate-in fade-in-0 zoom-in-95"
      style={{ left: position.x, top: position.y }}
    >
      {children}
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  shortcut,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  shortcut?: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-accent"
      }`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="text-label text-muted-foreground ml-4">{shortcut}</span>
      )}
    </button>
  )
}

function MenuSeparator() {
  return <hr className="my-1 border-border" />
}

// ---------------------------------------------------------------------------
// Canvas context menu
// ---------------------------------------------------------------------------

export function CanvasContextMenu({
  position,
  onClose,
  onPaste,
  onZoomFit,
  onSelectAll,
}: CanvasContextMenuProps) {
  return (
    <MenuWrapper position={position} onClose={onClose}>
      <MenuItem
        icon={ClipboardPaste}
        label="Paste"
        shortcut="Ctrl+V"
        onClick={() => {
          onPaste()
          onClose()
        }}
      />
      <MenuSeparator />
      <MenuItem
        icon={ZoomIn}
        label="Zoom to fit"
        onClick={() => {
          onZoomFit()
          onClose()
        }}
      />
      <MenuItem
        icon={Plus}
        label="Select all"
        shortcut="Ctrl+A"
        onClick={() => {
          onSelectAll()
          onClose()
        }}
      />
    </MenuWrapper>
  )
}

// ---------------------------------------------------------------------------
// Node context menu
// ---------------------------------------------------------------------------

export function NodeContextMenu({
  position,
  nodeId,
  nodeLabel,
  onClose,
  onDuplicate,
  onDelete,
  onDisconnect,
  onCopy,
  onRunNode,
}: NodeContextMenuProps) {
  return (
    <MenuWrapper position={position} onClose={onClose}>
      <div className="px-3 py-1 text-label text-muted-foreground truncate max-w-[200px]">
        {nodeLabel || nodeId}
      </div>
      <MenuSeparator />
      <MenuItem
        icon={Copy}
        label="Copy"
        shortcut="Ctrl+C"
        onClick={() => {
          onCopy()
          onClose()
        }}
      />
      <MenuItem
        icon={Copy}
        label="Duplicate"
        shortcut="Ctrl+D"
        onClick={() => {
          onDuplicate()
          onClose()
        }}
      />
      <MenuItem
        icon={Unlink}
        label="Disconnect all"
        onClick={() => {
          onDisconnect()
          onClose()
        }}
      />
      {onRunNode && (
        <>
          <MenuSeparator />
          <MenuItem
            icon={Play}
            label="Run this node"
            onClick={() => {
              onRunNode()
              onClose()
            }}
          />
        </>
      )}
      <MenuSeparator />
      <MenuItem
        icon={Trash2}
        label="Delete"
        shortcut="Del"
        danger
        onClick={() => {
          onDelete()
          onClose()
        }}
      />
    </MenuWrapper>
  )
}

// ---------------------------------------------------------------------------
// Edge context menu
// ---------------------------------------------------------------------------

export function EdgeContextMenu({
  position,
  edgeId,
  onClose,
  onDelete,
}: EdgeContextMenuProps) {
  return (
    <MenuWrapper position={position} onClose={onClose}>
      <MenuItem
        icon={Trash2}
        label="Delete connection"
        danger
        onClick={() => {
          onDelete()
          onClose()
        }}
      />
    </MenuWrapper>
  )
}
