import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const progressVariants = cva(
  "relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200",
  {
    variants: {
      size: {
        sm: "h-1.5",
        default: "h-2.5",
        lg: "h-4",
      },
    },
    defaultVariants: { size: "default" },
  }
)

interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
  value: number // 0-100
  color?: "brand" | "success" | "warning" | "danger"
}

function getMeterColor(value: number, color?: string) {
  if (color === "success") return "bg-success-500"
  if (color === "warning") return "bg-warning-500"
  if (color === "danger") return "bg-danger-500"
  if (value >= 80 && color === undefined) return "bg-brand-600"
  if (color === undefined) return "bg-brand-500"
  return "bg-brand-500"
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, color, size, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value))
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(progressVariants({ size, className }))}
        {...props}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${getMeterColor(clamped, color)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    )
  }
)
Progress.displayName = "Progress"
export { Progress }
