// ==========================================================================
// AppLayout — responsive layout supporting both desktop and extension popups.
//
// In an extension popup (width < 768px):
//   - Bottom navigation bar provides 1-tap access to primary pages
//   - Header menu button opens the full navigation drawer
//   - All drawer links navigate and auto-close the drawer
//
// On desktop (width >= 768px):
//   - Standard sidebar is displayed
// ==========================================================================

import { useState } from "react"
import { Outlet, NavLink, useLocation } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { useAppStore } from "@/store/appStore"
import { useIsMobile } from "@/hooks/useMobile"
import { Sheet, SheetContent } from "@/components/ui/Sheet"
import {
  X,
  LayoutDashboard,
  Shield,
  Target,
  Moon,
  Clock,
  Settings,
  BarChart2,
  Menu,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/platforms", label: "Platforms", icon: Shield },
  { to: "/app/focus", label: "Focus Mode", icon: Target },
  { to: "/app/namaz", label: "Namaz Mode", icon: Moon },
  { to: "/app/tracker", label: "Tracker", icon: Clock },
  { to: "/app/analytics", label: "Analytics", icon: BarChart2 },
  { to: "/app/settings", label: "Settings", icon: Settings },
]

const bottomNavItems = [
  { to: "/app", label: "Home", icon: LayoutDashboard, exact: true },
  { to: "/app/platforms", label: "Platforms", icon: Shield },
  { to: "/app/focus", label: "Focus", icon: Target },
  { to: "/app/namaz", label: "Namaz", icon: Moon },
]

function AppLayout() {
  const sidebarState = useAppStore((s) => s.sidebarState)
  const isMobile = useIsMobile()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Find page title for header
  const currentItem = navItems.find((item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to)
  )
  const title = currentItem?.label || "MediaBlocker"

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      {!isMobile && <Sidebar collapsed={sidebarState === "collapsed"} />}

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={title} onMenuToggle={() => setMobileOpen(true)} />
        <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </div>

        {/* Bottom Navigation Bar for Mobile & Extension Popup */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white/95 backdrop-blur border-t border-slate-200 flex items-center justify-around px-2 z-30">
            {bottomNavItems.map(({ to, label, icon: Icon, exact }) => {
              const isActive = exact
                ? location.pathname === to
                : location.pathname.startsWith(to)
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 py-1 gap-0.5 text-xs transition-colors",
                    isActive
                      ? "text-brand-600 font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive ? "text-brand-600" : "text-slate-400")} />
                  <span className="text-[10px] leading-tight">{label}</span>
                </NavLink>
              )
            })}
            {/* More / Menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center justify-center flex-1 py-1 gap-0.5 text-xs text-slate-500 hover:text-slate-800"
            >
              <Menu className="h-5 w-5 text-slate-400" />
              <span className="text-[10px] leading-tight">More</span>
            </button>
          </nav>
        )}
      </main>

      {/* Mobile & Popup Navigation Drawer */}
      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="left">
          <SheetContent className="!w-64 p-0 flex flex-col bg-white">
            <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-brand-600" />
                <span className="font-semibold text-slate-900 text-sm">MediaBlocker</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
              {navItems.map(({ to, label, icon: Icon, exact }) => {
                const isActive = exact
                  ? location.pathname === to
                  : location.pathname.startsWith(to)
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-700 font-semibold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand-600" : "text-slate-400")} />
                    <span>{label}</span>
                  </NavLink>
                )
              })}
            </nav>

            <div className="p-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
              MediaBlocker v2.0.0
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

export default AppLayout
