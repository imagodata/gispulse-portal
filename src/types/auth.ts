/** Auth and billing types matching backend models. */

export type UserRole = "viewer" | "editor" | "admin" | "owner"
export type OrgTier = "community" | "pro" | "team" | "enterprise"
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "paused"

export interface OrgInfo {
  id: string
  name: string
  tier: OrgTier
  subscription_status: SubscriptionStatus
  trial_ends_at?: string
  current_period_end?: string
  next_invoice_at?: string
  next_invoice_amount?: number
  currency?: string
}

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  role: UserRole
  org: OrgInfo
}

export interface AuthProvider {
  id: string
  name: string
  type: "oidc" | "saml"
  enabled: boolean
}

export interface SubscriptionInfo {
  plan: OrgTier
  status: SubscriptionStatus
  current_period_start: string
  current_period_end: string
  trial_end?: string
  cancel_at_period_end: boolean
  next_invoice?: {
    amount: number
    currency: string
    due_date: string
  }
}
