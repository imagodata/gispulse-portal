/**
 * LoginPage — Public route /login
 *
 * Two modes:
 *  - OIDC/SSO: shows a "Sign in with SSO" button that redirects to GET /auth/login
 *  - API key:  shows an API key input (for self-hosted / dev setups)
 *
 * If no providers are configured, shows only the API key mode.
 * The page is fully public (no auth guard).
 */

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { LogIn, Key, AlertCircle, Loader2 } from "lucide-react"
import { GISPulseLogo } from "@/components/GISPulseLogo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuthStore, selectRbacEnabled } from "@/stores/authStore"
import { initiateLogin } from "@/api/auth"
import { cn } from "@/lib/utils"

export function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, providers, error, initialized, clearError } =
    useAuthStore()
  const rbacEnabled = useAuthStore(selectRbacEnabled)

  const [apiKey, setApiKey] = useState("")
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [submittingApiKey, setSubmittingApiKey] = useState(false)

  // If already authenticated, redirect to app
  useEffect(() => {
    if (initialized && isAuthenticated) {
      navigate("/", { replace: true })
    }
  }, [initialized, isAuthenticated, navigate])

  // Clear store error on unmount
  useEffect(() => () => clearError(), [clearError])

  const hasOidcProvider = providers.some((p) => p.type === "oidc" && p.enabled)

  async function handleApiKeySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) {
      setApiKeyError("Please enter an API key")
      return
    }
    setApiKeyError(null)
    setSubmittingApiKey(true)
    try {
      // Store in sessionStorage — backend will validate via Authorization header
      // This is intentionally NOT httpOnly but acceptable for non-OIDC dev mode
      sessionStorage.setItem("gispulse:api-key", apiKey.trim())
      navigate("/", { replace: true })
    } catch {
      setApiKeyError("Invalid API key")
    } finally {
      setSubmittingApiKey(false)
    }
  }

  if (isLoading && !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <GISPulseLogo animated size={48} className="text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo — large animated, vertical layout */}
        <div className="mb-10 flex flex-col items-center gap-4">
          <GISPulseLogo animated size={80} className="text-foreground" />
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-2xl font-bold tracking-tight">GISPulse</h1>
            <p className="text-sm text-muted-foreground text-center">
              Geospatial processing platform
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col gap-5">
          <div>
            <h2 className="text-base font-semibold">Sign in to your workspace</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Continue to GISPulse
            </p>
          </div>

          {/* Global error from authStore */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SSO button — only shown when OIDC provider configured */}
          {rbacEnabled && hasOidcProvider && (
            <div className="flex flex-col gap-3">
              {providers
                .filter((p) => p.type === "oidc" && p.enabled)
                .map((provider) => (
                  <Button
                    key={provider.id}
                    className="w-full"
                    onClick={() => initiateLogin()}
                    disabled={isLoading}
                  >
                    <LogIn size={16} />
                    Sign in with {provider.name}
                  </Button>
                ))}

              {/* Divider */}
              <div className="relative flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          {/* API key form */}
          <form onSubmit={handleApiKeySubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="api-key"
                className="text-xs font-medium text-foreground"
              >
                API Key
              </label>
              <div className="relative">
                <Key
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  id="api-key"
                  type="password"
                  placeholder="gp_live_..."
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    if (apiKeyError) setApiKeyError(null)
                  }}
                  className={cn("pl-8", apiKeyError && "border-destructive")}
                  aria-describedby={apiKeyError ? "api-key-error" : undefined}
                  aria-invalid={apiKeyError ? true : undefined}
                  autoComplete="current-password"
                />
              </div>
              {apiKeyError && (
                <p id="api-key-error" className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={12} />
                  {apiKeyError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submittingApiKey || !apiKey.trim()}
            >
              {submittingApiKey && <Loader2 size={14} className="animate-spin" />}
              Continue
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Need an account?{" "}
          <a
            href="/pricing"
            className="text-primary underline-offset-4 hover:underline"
          >
            View pricing
          </a>
        </p>
      </div>
    </div>
  )
}
