/**
 * UserMenu — Dropdown in the TopNav showing user info, nav links, and logout.
 *
 * States:
 *  - Authenticated: avatar/name, links to Profile / Admin / Billing, Logout button
 *  - Not authenticated: "Sign in" button
 *  - Loading: skeleton avatar
 */

import { useNavigate } from "react-router-dom"
import { User, CreditCard, Shield, LogOut, LogIn, Loader2, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/authStore"
import { hasRole } from "@/stores/authStore"
import { cn } from "@/lib/utils"

const TIER_LABEL: Record<string, string> = {
  community: "Community",
  pro: "Pro",
  team: "Team",
  enterprise: "Enterprise",
}

const ROLE_COLOR: Record<string, string> = {
  viewer: "secondary",
  editor: "secondary",
  admin: "default",
  owner: "default",
}

function UserAvatar({
  name,
  avatarUrl,
  size = "sm",
}: {
  name: string
  avatarUrl?: string
  size?: "sm" | "md"
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")

  const sizeClass = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm"

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn("rounded-full object-cover", sizeClass)}
      />
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium select-none",
        sizeClass,
      )}
      aria-hidden="true"
    >
      {initials || <User size={12} />}
    </div>
  )
}

export function UserMenu() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, initialized, logout } = useAuthStore()

  // While checking session — show a ghost placeholder
  if (!initialized || (isLoading && !user)) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted animate-pulse" />
    )
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/login")}
        className="gap-1.5 text-xs"
      >
        <LogIn size={14} />
        Sign in
      </Button>
    )
  }

  const isAdmin = hasRole(user, "admin")
  const tierLabel = TIER_LABEL[user.org.tier] ?? user.org.tier

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`User menu for ${user.name}`}
      >
        <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="sm" />
        <span className="hidden sm:inline max-w-[100px] truncate font-medium text-foreground">
          {user.name.split(" ")[0]}
        </span>
        <ChevronDown size={12} className="opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="bottom" sideOffset={6}>
        {/* User info header */}
        <div className="flex items-center gap-2.5 px-2 py-2.5">
          <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="md" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium truncate text-foreground">{user.name}</span>
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            <div className="flex items-center gap-1 mt-0.5">
              <Badge
                variant={ROLE_COLOR[user.role] as "default" | "secondary" ?? "secondary"}
                className="text-[10px] h-4 px-1.5"
              >
                {user.role}
              </Badge>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                {tierLabel}
              </Badge>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Account</DropdownMenuLabel>

        <DropdownMenuItem onClick={() => navigate("/billing")}>
          <CreditCard size={14} />
          Billing
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem onClick={() => navigate("/admin")}>
            <Shield size={14} />
            Admin
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            if (isLoading) return
            logout()
          }}
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <LogOut size={14} />
          )}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
