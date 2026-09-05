import { Menu } from "lucide-react"
import { useAppStore } from "@/store/appStore"

function Header({
  title,
  onMenuToggle,
}: {
  title?: string
  onMenuToggle?: () => void
}) {
  const sidebarState = useAppStore((s) => s.sidebarState)

  return (
    <header className="h-14 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex items-center px-4 sticky top-0 z-30">
      {onMenuToggle && (
        <button
          onClick={onMenuToggle}
          className="mr-3 lg:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      {sidebarState === "expanded" && (
        <h1 className="text-sm font-semibold text-slate-800">{title || "Dashboard"}</h1>
      )}
      <div className="ml-auto flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700">
          MB
        </div>
      </div>
    </header>
  )
}

export { Header }
