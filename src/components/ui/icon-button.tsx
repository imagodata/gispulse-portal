import { type ComponentProps, forwardRef } from "react"
import { cn } from "@/lib/utils"

interface IconButtonProps extends ComponentProps<"button"> {
  label: string
  size?: "sm" | "md"
  variant?: "ghost" | "active" | "destructive"
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, size = "sm", variant = "ghost", className, children, ...props }, ref) => {
    const sizeClasses = size === "sm" ? "h-5 w-5" : "h-6 w-6"
    const variantClasses = {
      ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
      active: "text-foreground bg-accent",
      destructive: "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
    }

    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex items-center justify-center rounded transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          sizeClasses,
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
IconButton.displayName = "IconButton"

export { IconButton }
