/**
 * TierGate — Feature gate based on org tier.
 *
 * Usage:
 *   <TierGate requiredTier="pro" currentTier={user.org.tier}>
 *     <SchedulerPanel />
 *     <TierGate.Fallback>
 *       <UpgradePrompt tier="pro" feature="Scheduled Pipelines" />
 *     </TierGate.Fallback>
 *   </TierGate>
 *
 * Rules:
 *  - Never hides the feature completely — always shows the fallback so
 *    users know the feature exists.
 *  - TierGate.Fallback is REQUIRED: renders when tier is insufficient.
 *  - If currentTier is undefined (not loaded yet), renders neither child
 *    until tier is known (isLoading state from authStore).
 */

import React from "react"
import { useNavigate } from "react-router-dom"
import { ArrowUpRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { hasTier, TIER_RANK } from "@/stores/authStore"
import type { OrgTier } from "@/types/auth"

// ---------------------------------------------------------------------------
// Internal Fallback sentinel
// ---------------------------------------------------------------------------

const FALLBACK_TYPE = Symbol("TierGate.Fallback")

interface FallbackProps {
  children: React.ReactNode
}

function Fallback({ children }: FallbackProps) {
  return <>{children}</>
}
Fallback.displayName = "TierGate.Fallback"
// Attach a type marker so TierGate can identify it among its children
;(Fallback as unknown as { _type: symbol })._type = FALLBACK_TYPE

// ---------------------------------------------------------------------------
// Default UpgradePrompt — used when no custom Fallback content is provided
// ---------------------------------------------------------------------------

export function UpgradePrompt({
  tier,
  feature,
  compact = false,
}: {
  tier: OrgTier
  feature?: string
  compact?: boolean
}) {
  const navigate = useNavigate()
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1)

  if (compact) {
    return (
      <button
        onClick={() => navigate("/pricing")}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-4 font-medium"
      >
        <Sparkles size={12} />
        Upgrade to {tierLabel}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-6 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <Sparkles size={20} className="text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {feature ? `${feature} requires ${tierLabel}` : `Requires ${tierLabel} plan`}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Upgrade your plan to unlock this feature.
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => navigate("/pricing")}
        className="gap-1.5"
      >
        View pricing
        <ArrowUpRight size={14} />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TierGate
// ---------------------------------------------------------------------------

interface TierGateProps {
  requiredTier: OrgTier
  currentTier: OrgTier | undefined
  children: React.ReactNode
}

function TierGate({ requiredTier, currentTier, children }: TierGateProps) {
  const allowed = currentTier !== undefined && hasTier(currentTier, requiredTier)

  // Separate children into [content, fallback]
  let contentChildren: React.ReactNode[] = []
  let fallbackChildren: React.ReactNode = null

  React.Children.forEach(children, (child) => {
    if (
      React.isValidElement(child) &&
      (child.type as unknown as { _type?: symbol })._type === FALLBACK_TYPE
    ) {
      fallbackChildren = (child as React.ReactElement<FallbackProps>).props.children
    } else {
      contentChildren.push(child)
    }
  })

  if (currentTier === undefined) {
    // Tier not loaded yet — render nothing (parent should show skeleton)
    return null
  }

  if (allowed) {
    return <>{contentChildren}</>
  }

  // Not allowed — show fallback. If no custom fallback, use UpgradePrompt
  if (fallbackChildren) {
    return <>{fallbackChildren}</>
  }

  return (
    <UpgradePrompt
      tier={requiredTier}
      feature={undefined}
    />
  )
}

TierGate.Fallback = Fallback

export { TierGate }

// ---------------------------------------------------------------------------
// Convenience hook
// ---------------------------------------------------------------------------

import { useAuthStore } from "@/stores/authStore"

/**
 * Returns { allowed, currentTier } for use outside of JSX.
 * Example: const { allowed } = useTierGate("pro")
 */
export function useTierGate(requiredTier: OrgTier) {
  const user = useAuthStore((s) => s.user)
  const currentTier = user?.org.tier
  const allowed = hasTier(currentTier, requiredTier)
  return { allowed, currentTier }
}

// Keep TIER_RANK exported for consumers that need ordering
export { TIER_RANK }
