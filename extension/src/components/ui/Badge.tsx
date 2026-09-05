import * as React from "react"
import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-slate-100 text-slate-700",
        brand:
          "bg-brand-100 text-brand-800",
        success:
          "bg-success-500/10 text-success-600",
        warning:
          "bg-warning-500/10 text-warning-600",
        danger:
          "bg-danger-500/10 text-danger-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dismissible?: boolean
  onDismiss?: () => void
}

function Badge({
  className,
  variant,
  dismissible,
  onDismiss,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      <span className="truncate">{children}</span>
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          className="hover:text-danger-500 rounded-full -mr-0.5 ml-0.5"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

export { Badge, badgeVariants }
