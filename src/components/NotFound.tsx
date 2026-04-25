import { Link } from "react-router-dom"

export function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center p-8">
      <span className="text-5xl font-bold text-muted-foreground/30">404</span>
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/explorer"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Go to Explorer
      </Link>
    </div>
  )
}
