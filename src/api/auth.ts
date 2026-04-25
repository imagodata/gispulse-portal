/**
 * api/auth.ts — Auth and billing endpoints.
 *
 * Auth uses cookie-based sessions (httpOnly, set by the backend).
 * No tokens are stored in localStorage.
 *
 * Billing redirects go through Stripe — URLs are returned by the API.
 */

import type { User, AuthProvider, SubscriptionInfo } from "@/types/auth"

// Auth lives at /api/auth, not /api/portal
const AUTH_BASE = "/api/auth"
const BILLING_BASE = "/api/billing"

async function authRequest<T>(
  path: string,
  init: RequestInit = {},
  base = AUTH_BASE,
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    credentials: "include", // Send cookies with every request
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  })

  if (res.status === 401) {
    throw new AuthError(401, "Unauthenticated")
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export class AuthError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "AuthError"
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

/** Fetch the currently authenticated user. Throws AuthError(401) if not logged in. */
export async function fetchMe(): Promise<User> {
  return authRequest<User>("/me")
}

/** Get available SSO/OIDC providers. */
export async function fetchProviders(): Promise<AuthProvider[]> {
  return authRequest<AuthProvider[]>("/providers")
}

/**
 * Redirect the browser to the OIDC login URL.
 * The backend returns a redirect — we navigate directly.
 */
export function initiateLogin(): void {
  window.location.href = `${AUTH_BASE}/login`
}

/** Logout: clears the server-side session, then the cookie. */
export async function logout(): Promise<void> {
  await authRequest<void>("/logout", { method: "POST" })
}

// ---------------------------------------------------------------------------
// Billing endpoints
// ---------------------------------------------------------------------------

/** Get current subscription info. */
export async function fetchSubscription(): Promise<SubscriptionInfo> {
  return authRequest<SubscriptionInfo>("/subscription", undefined, BILLING_BASE)
}

export interface CheckoutRequest {
  plan: "pro" | "team"
  billing_interval: "monthly" | "yearly"
}

export interface CheckoutResponse {
  checkout_url: string
}

/** Create a Stripe checkout session and return the checkout URL. */
export async function createCheckout(
  payload: CheckoutRequest,
): Promise<CheckoutResponse> {
  return authRequest<CheckoutResponse>(
    "/checkout",
    { method: "POST", body: JSON.stringify(payload) },
    BILLING_BASE,
  )
}

/** Get the Stripe Customer Portal URL for managing billing. */
export async function getBillingPortalUrl(): Promise<{ portal_url: string }> {
  return authRequest<{ portal_url: string }>("/portal", undefined, BILLING_BASE)
}
