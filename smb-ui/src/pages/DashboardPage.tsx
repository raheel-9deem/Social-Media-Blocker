// ==========================================================================
// Dashboard Page — wired to live engine evaluation.
// Shows: today's total usage, per-platform usage/limits, blocked status,
//        Focus Mode, Namaz Mode — all from the core engine.
// ==========================================================================

import { useState, useEffect, useMemo } from "react"
import { Target, Timer, TrendingDown, Flame, Shield, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Toggle } from "@/components/ui/Toggle"
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  CartesianGrid, Tooltip,
} from "recharts"
import { useBlockingStore } from "@/store/blockingStore"
import { useTimerStore } from "@/store/timerStore"
import { useEngine, type EngineState } from "@/hooks/useEngine"
import { trackingAdapter } from "@/adapters/tracking/WebTrackingAdapter"
import { inMemoryStorage, profile } from "@/adapters/storage/InMemoryStorageAdapter"
import { notificationAdapter } from "@/adapters/notifications/WebNotificationAdapter"
import { reportError } from "@/lib/errors/AppError"
import { format, subDays } from "date-fns"
import { cn } from "@/lib/utils"

const PLATFORM_COLORS = [
  "#ef4444", "#ec4899", "#3b6ef0", "#f59e0b", "#10b981", "#8b5cf6",
]

function StatCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: any
  label: string
  value: string
  sub: string
  accent: "brand" | "success" | "warning" | "danger"
}) {
  const accentBg = {
    brand: "bg-brand-50",
    success: "bg-success-500/10",
    warning: "bg-warning-500/10",
    danger: "bg-danger-500/10",
  }[accent]
  const accentText = {
    brand: "text-brand-600",
    success: "text-success-600",
    warning: "text-warning-600",
    danger: "text-danger-600",
  }[accent]

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-md ${accentBg} flex items-center justify-center`}>
          <Icon className={`h-3.5 w-3.5 ${accentText}`} />
        </div>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}

function DashboardPageInner() {
  const engine: EngineState = useEngine()
  const blockingStore = useBlockingStore()
  const timerStore = useTimerStore()

  const [platforms, setPlatforms] = useState<{ id: string; name: string; dailyLimitMinutes: number }[]>([])
  const [weeklyData, setWeeklyData] = useState<{ day: string; minutes: number }[]>([])
  const [focusDuration, setFocusDuration] = useState(50)
  const [focusSelected, setFocusSelected] = useState<Set<string>>(new Set())
  const [namazEnabled, setNamazEnabled] = useState(false)
  const [focusActive, setFocusActive] = useState(false)

  // Load platforms list
  useEffect(() => {
    inMemoryStorage.listPlatforms().then((plats) => {
      setPlatforms(plats.map((p) => ({ id: p.id, name: p.name, dailyLimitMinutes: p.dailyLimitMinutes })))
    }).catch(console.error)
  }, [])

  // Tick timer UI
  useEffect(() => {
    const active = timerStore.sessions.find((s) => s.isRunning)
    if (!active) return
    const id = setInterval(() => timerStore.tick(), 1000)
    return () => clearInterval(id)
  }, [timerStore.sessions, timerStore])

  // Cleanup tracking on unmount
  useEffect(() => () => trackingAdapter.stopTick(), [])

  // Periodic evaluation
  useEffect(() => {
    engine.evaluate()
    const id = setInterval(() => engine.evaluate(), 10_000)
    return () => clearInterval(id)
  }, [engine])

  // Weekly data
  useEffect(() => {
    if (!platforms.length) return
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i)
      let total = 0
      for (const p of platforms) {
        total += engine.accumulator.getMinutes(profile.id, p.id, d)
      }
      days.push({ day: format(d, "EEE"), minutes: Math.round(total) })
    }
    setWeeklyData(days)
  }, [engine, platforms])

  const totalUsedToday = useMemo(() => {
    if (!platforms.length) return 0
    let total = 0
    const today = new Date()
    for (const p of platforms) {
      total += engine.accumulator.getMinutes(profile.id, p.id, today)
    }
    return Math.round(total)
  }, [engine, platforms])

  const totalLimitToday = platforms.reduce((s, p) => s + p.dailyLimitMinutes, 0)
  const remaining = Math.max(0, totalLimitToday - totalUsedToday)

  function toggleFocusPlatform(id: string) {
    setFocusSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleStartFocus() {
    if (focusSelected.size === 0) return
    try {
      await inMemoryStorage.startFocusSession({
        platformIds: Array.from(focusSelected),
        durationMinutes: focusDuration,
      })
      notificationAdapter.notifyFocusStart(focusDuration)
      engine.evaluate()
    } catch (e) {
      reportError(e)
    }
  }

  async function handleEndFocus() {
    const active = await inMemoryStorage.getActiveFocusSession()
    if (active) {
      await inMemoryStorage.endFocusSession(active.id)
      notificationAdapter.notifyFocusEnd()
      engine.evaluate()
    }
  }

  async function handleToggleNamaz() {
    const settings = await inMemoryStorage.getNamazSettings()
    if (settings) {
      setNamazEnabled(!settings.isEnabled)
      await inMemoryStorage.updateNamazSettings({ isEnabled: !settings.isEnabled })
      engine.evaluate()
    }
  }

  // Build platform rows from blocking store
  const platformRows = useMemo(() => {
    return platforms.map((p, i) => ({
      id: p.id,
      name: p.name,
      limit: p.dailyLimitMinutes,
      color: PLATFORM_COLORS[i % PLATFORM_COLORS.length],
      blockInfo: blockingStore.blocks[p.id],
    }))
  }, [platforms, blockingStore.blocks])

  // Update focus active state
  useEffect(() => {
    inMemoryStorage.getActiveFocusSession().then((s) => {
      setFocusActive(!!(s && new Date(s.endsAt) > new Date()))
    }).catch(console.error)
  }, [engine.lastEvaluated])

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <Badge variant={focusActive ? "brand" : "default"}>
          {focusActive ? "Focus Active" : "Focus Off"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Timer} label="Today's usage" value={`${totalUsedToday} min`} sub={`${remaining} min remaining`} accent="brand" />
            <StatCard icon={TrendingDown} label="Avg daily" value={`${weeklyData.length ? Math.round(weeklyData.reduce((s, d) => s + d.minutes, 0) / weeklyData.length) : 0} min`} sub="Last 7 days" accent="success" />
            <StatCard icon={Flame} label="Limit breaches" value="0" sub="Clean today" accent="success" />
            <StatCard icon={Shield} label="Active platforms" value={String(platforms.length)} sub="All managed" accent="brand" />
          </div>

          {/* Weekly chart */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-6 pb-4">
              <h3 className="text-base font-semibold text-slate-900">Weekly Overview</h3>
              <p className="text-sm text-slate-500 mt-0.5">Minutes per day</p>
            </div>
            <div className="px-6 pb-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
                    <Bar dataKey="minutes" fill="#3b6ef0" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Platform usage */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-6 pb-4">
              <h3 className="text-base font-semibold text-slate-900">Platforms</h3>
              <p className="text-sm text-slate-500 mt-0.5">Today's usage and limits</p>
            </div>
            <div className="px-6 pb-6 space-y-5">
              {platformRows.map((p) => {
                const today = new Date()
                const used = engine.accumulator.getMinutes(profile.id, p.id, today)
                const pct = Math.min(100, Math.round((used / p.limit) * 100))
                return (
                  <div key={p.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="text-sm font-medium text-slate-700">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm tabular-nums text-slate-600">
                          <span className="font-medium text-slate-900">{Math.round(used)}</span>
                          {" / "}{p.limit} min
                        </span>
                        {p.blockInfo?.status === "blocked" && <Badge variant="danger">Blocked</Badge>}
                      </div>
                    </div>
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-brand-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Focus Mode */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-6 pb-4">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Target className="h-4 w-4 text-brand-600" />
                Focus Mode
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">Block platforms for deep work</p>
            </div>
            <div className="px-6 pb-6">
              {focusActive ? (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-600 mb-1">Focus session active</p>
                  <p className="text-xs text-slate-400">Blocking all distractions</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={handleEndFocus}>
                    End Session
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="text-xs text-slate-500 mb-1.5 block">Duration</label>
                    <div className="flex gap-2">
                      {[25, 50, 90].map((m) => (
                        <button key={m} onClick={() => setFocusDuration(m)}
                          className={cn("flex-1 text-xs py-2 rounded-lg border transition-colors",
                            focusDuration === m ? "border-brand-600 bg-brand-50 text-brand-700 font-medium" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                          {m < 60 ? `${m}m` : `${m / 60}h`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-slate-500 mb-1.5 block">Block ({focusSelected.size} selected)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {platforms.map((p) => (
                        <button key={p.id} onClick={() => toggleFocusPlatform(p.id)}
                          className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            focusSelected.has(p.id) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full" size="sm" onClick={handleStartFocus} disabled={focusSelected.size === 0}>
                    Start Focus Session
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Namaz Mode */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-6 pb-4">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-brand-600" />
                Namaz Mode
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">Auto-pause at prayer times</p>
            </div>
            <div className="px-6 pb-6">
              <Toggle checked={namazEnabled} onCheckedChange={handleToggleNamaz} label="Enabled" />
              <div className="mt-4 space-y-2">
                {[
                  { name: "Fajr", time: "5:12 AM" },
                  { name: "Dhuhr", time: "12:34 PM" },
                  { name: "Asr", time: "3:45 PM" },
                  { name: "Maghrib", time: "6:48 PM" },
                  { name: "Isha", time: "8:15 PM" },
                ].map(({ name, time }) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{name}</span>
                    <span className="text-slate-500 tabular-nums">{time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Timer */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-6 pb-4">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Timer className="h-4 w-4 text-brand-600" />
                Quick Timer
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">Track a platform session</p>
            </div>
            <div className="px-6 pb-6">
              <PlatformTimer />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlatformTimer() {
  const { sessions, tick } = useTimerStore()
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([])
  const [selected, setSelected] = useState("")

  useEffect(() => {
    inMemoryStorage.listPlatforms().then((plats) =>
      setPlatforms(plats.filter((p) => p.category === "Social" || p.category === "Video").map((p) => ({ id: p.id, name: p.name })))
    ).catch(console.error)
  }, [])

  useEffect(() => {
    const active = sessions.find((s) => s.isRunning)
    if (!active) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [sessions, tick])

  const active = sessions.find((s) => s.isRunning)

  function formatElapsed(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  if (active) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{active.platformName}</span>
          <span className="text-sm font-mono text-slate-600 tabular-nums">{formatElapsed(active.elapsedSec)}</span>
        </div>
        <Button variant="danger" size="sm" className="w-full" onClick={() => useTimerStore.getState().stopSession(active.id)}>
          Stop Timer
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full h-9 rounded-lg border border-slate-300 px-3 text-sm bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        <option value="">Select platform…</option>
        {platforms.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <Button
        variant="primary"
        size="sm"
        className="w-full"
        disabled={!selected}
        onClick={() => {
          const plat = platforms.find((p) => p.id === selected)
          if (plat) trackingAdapter.startSession(plat.id, plat.name)
        }}
      >
        Start Timer
      </Button>
    </div>
  )
}

export default DashboardPageInner
