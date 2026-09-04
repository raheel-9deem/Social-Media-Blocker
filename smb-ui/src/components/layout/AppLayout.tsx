import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { useAppStore } from "@/store/appStore"
import { useIsMobile } from "@/hooks/useMobile"
import { Sheet, SheetContent } from "@/components/ui/Sheet"
import { X } from "lucide-react"
import { Button } from "@/components/ui/Button"

function AppLayout() {
  const sidebarState = useAppStore((s) => s.sidebarState)
  const isMobile = useIsMobile()
  const [mobileOpen, setMobileOpen] = useState(false)

  // On desktop, use the persisted sidebarState. On mobile, the Sheet handles nav.
  const showSidebar = !isMobile

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Desktop sidebar */}
      {showSidebar && <Sidebar collapsed={sidebarState === "collapsed"} />}

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title="" onMenuToggle={() => setMobileOpen(true)} />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Sheet (hamburger nav) */}
      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="!w-72 p-0">
            <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100">
              <span className="font-semibold text-slate-900 text-sm">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2">
              {/* We'll render nav links content here. For MVP, the sidebar itself component can be reused, but since it uses NavLink — let's just render via the Sidebar collapsed=false and overlay. */}
              <p className="text-xs text-center text-slate-400 py-8">
                Navigation items render in desktop sidebar.<br />
                Use menu icon on large screens.
              </p>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

export default AppLayout
