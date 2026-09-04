import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface SheetContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  side: "left" | "right" | "top" | "bottom"
}

const SheetContext = React.createContext<SheetContextValue>({
  open: false,
  onOpenChange: () => {},
  side: "right",
})

const sidePositionMap: Record<string, string> = {
  left: "inset-y-0 left-0",
  right: "inset-y-0 right-0",
  top: "inset-x-0 top-0",
  bottom: "inset-x-0 bottom-0",
}

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: "left" | "right" | "top" | "bottom"
  children?: React.ReactNode
}

function Sheet({ open, onOpenChange, side = "right", children }: SheetProps) {
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
    <SheetContext.Provider value={{ open, onOpenChange, side }}>
      <div className="fixed inset-0 z-50 flex">
        <div
          className="bg-slate-900/40 absolute inset-0 backdrop-blur-sm animate-fade"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
        <div
          className={cn(
            "relative z-10 bg-white shadow-xl transition-transform animate-in",
            side === "left" && "animate-slide-in-left",
            side === "right" && "animate-slide-in-right",
            side === "top" && "animate-slide-in-top",
            side === "bottom" && "animate-slide-in-bottom",
            sidePositionMap[side],
            side === "left" || side === "right" ? "w-80 max-w-[85vw]" : "h-80 max-h-[85vw]"
          )}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-600 absolute top-3 right-3 rounded-lg p-1 z-10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          {children}
        </div>
      </div>
    </SheetContext.Provider>,
    document.body
  )
}

const sideSlideKeyframes = {
  left: "slide-in-left",
  right: "slide-in-right",
  top: "slide-in-top",
  bottom: "slide-in-bottom",
}

// Inject keyframes once
if (typeof document !== "undefined") {
  const styleId = "sheet-animations"
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style")
    style.id = styleId
    style.textContent = `
      @keyframes slide-in-left {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
      }
      @keyframes slide-in-right {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      @keyframes slide-in-top {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
      @keyframes slide-in-bottom {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
    `
    document.head.appendChild(style)
  }
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {}

function SheetContent({ className, ...props }: SheetContentProps) {
  return (
    <div className={cn("p-6 overflow-auto", className)} {...props} />
  )
}

export { Sheet, SheetContent }
