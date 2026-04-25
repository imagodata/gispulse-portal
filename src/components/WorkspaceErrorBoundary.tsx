import { Component, type ReactNode, type ErrorInfo } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface Props {
  children: ReactNode
  /** Workspace name for the error message */
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Per-workspace error boundary — catches crashes in individual workspace views
 * without taking down the entire app shell (TopNav, panels stay live).
 */
export class WorkspaceErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[GISPulse] Workspace error (${this.props.name ?? "unknown"}):`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex h-full flex-col items-center justify-center gap-3 text-center p-8"
        >
          <AlertTriangle size={32} className="text-destructive/50" />
          <h2 className="text-sm font-semibold">
            {this.props.name ? `${this.props.name} crashed` : "Workspace crashed"}
          </h2>
          <p className="text-xs text-muted-foreground max-w-xs font-mono break-all">
            {this.state.error?.message ?? "Unknown error"}
          </p>
          <button
            type="button"
            className="mt-2 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
