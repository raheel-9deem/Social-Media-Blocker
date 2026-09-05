import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  Target,
  Clock,
  Settings,
  Shield,
  Moon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/platforms", label: "Platforms", icon: Shield },
  { to: "/app/tracker", label: "Tracker", icon: Clock },
  { to: "/app/focus", label: "Focus Mode", icon: Target },
  { to: "/app/namaz", label: "Namaz Mode", icon: Moon },
  { to: "/app/settings", label: "Settings", icon: Settings },
]

function Sidebar({ collapsed }: { collapsed: boolean }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
      collapsed && "justify-center px-0",
      isActive
        ? "bg-brand-50 text-brand-700"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    )

  return (
    <aside
      className={cn(
        "h-screen border-r border-slate-200 bg-white flex flex-col transition-all duration-300 sticky top-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-3 border-b border-slate-100">
        {collapsed ? (
          <Shield className="h-6 w-6 text-brand-600 mx-auto" />
        ) : (
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-600" />
            <span className="font-semibold text-slate-900 text-sm">
              MediaBlocker
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass}>
            {({ isActive }) => (
              <>
                <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-brand-600")} />
                {!collapsed && <span>{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export { Sidebar }
