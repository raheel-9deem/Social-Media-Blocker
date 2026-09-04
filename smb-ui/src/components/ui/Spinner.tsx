import * as React from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"
}

function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("inline-flex items-center", className)}
      {...props}
    >
      <Loader2 className={cn(sizeClasses[size], "animate-spin text-brand-600")} />
    </div>
  )
}

interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string
}

function LoadingOverlay({
  className,
  message = "Loading…",
  ...props
}: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12",
        className
      )}
      {...props}
    >
      <Spinner size="lg" />
      {message && (
        <p className="text-sm text-slate-500">{message}</p>
      )}
    </div>
  )
}

// ---- Error Boundary ----

interface ErrorBoundaryProps {
  fallback?: React.ReactNode
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ClassErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="rounded-xl border border-danger-500/30 bg-danger-500/8 p-6 text-center">
          <p className="text-sm font-medium text-danger-700">
            Something went wrong.
          </p>
          <p className="text-xs text-danger-600/70 mt-1">
            {this.state.error?.message}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

export { Spinner, LoadingOverlay, ClassErrorBoundary as ErrorBoundary }
