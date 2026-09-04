import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"

interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
}

function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  children,
  className,
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [open, onOpenChange])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="bg-slate-900/40 absolute inset-0 backdrop-blur-sm animate-fade"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-xl bg-white shadow-xl animate-in",
          sizeClasses[size],
          className
        )}
      >
        {(title || description) && (
          <div className="border-b border-slate-100 px-6 py-4">
            {title && (
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        <button
          onClick={() => onOpenChange(false)}
          className="text-slate-400 hover:text-slate-600 absolute top-4 right-4 transition-colors rounded-lg p-1"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body
  )
}

export { Modal }
