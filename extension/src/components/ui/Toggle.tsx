import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center gap-2 rounded-full px-1 transition-colors cursor-pointer select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-slate-200 data-[checked=true]:bg-brand-600",
      },
      size: {
        sm: "h-7 w-11 [&>span]:h-5 [&>span]:w-5",
        default: "h-9 w-[52px] [&>span]:h-7 [&>span]:w-7",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ToggleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    VariantProps<typeof toggleVariants> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: string
  labelClassName?: string
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    { className, variant, size, checked, onCheckedChange, label, labelClassName, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={!!checked}
        data-checked={!!checked}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(toggleVariants({ variant, size, className }))}
        {...props}
      >
        <span
          className="block rounded-full bg-white shadow-sm transition-transform data-[checked=true]:translate-x-5"
        />
        {label && (
          <span className={cn("text-sm font-medium text-slate-700", labelClassName)}>
            {label}
          </span>
        )}
      </button>
    )
  }
)
Toggle.displayName = "Toggle"

export { Toggle, toggleVariants }
