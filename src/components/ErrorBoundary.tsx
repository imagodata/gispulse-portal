import { Component, type ReactNode, type ErrorInfo, useState } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  info: ErrorInfo | null
}

// Stack trace details — shown collapsed by default (#209)
function StackDetails({ error, info }: { error: Error; info: ErrorInfo | null }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 w-full max-w-lg text-left">
      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Hide" : "Show"} stack trace
      </button>
      {open && (
        <pre className="mt-2 max-h-48 overflow-auto rounded border bg-muted p-3 text-label leading-relaxed text-muted-foreground whitespace-pre-wrap break-all">
          {error.stack ?? error.message}
          {info?.componentStack ? `\n\nComponent stack:${info.componentStack}` : ""}
        </pre>
      )}
    </div>
  )
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[GISPulse] Uncaught error:", error, info)
    this.setState({ info })
  }

  render() {
    if (this.state.hasError) {
      const { error, info } = this.state
      return (
        <div
          role="alert"
          className="flex h-full flex-col items-center justify-center gap-3 text-center p-8"
        >
          <span className="text-5xl font-bold text-destructive/30" aria-hidden="true">!</span>
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-sm font-mono break-all">
            {error?.message ?? "Unknown error"}
          </p>

          {error && <StackDetails error={error} info={info} />}

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              onClick={() => this.setState({ hasError: false, error: null, info: null })}
            >
              Reset
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
