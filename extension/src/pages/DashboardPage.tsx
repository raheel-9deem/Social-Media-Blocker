// ==========================================================================
// Dashboard Page — fully wired to the engine.
// Shows: today's usage, per-platform bars, blocked counts, weekly chart,
//        Focus Mode with live countdown, Namaz Mode, Quick Timer.
// ==========================================================================

import { useState, useEffect, useMemo } from "react"
import {
  Timer, TrendingDown, Flame, Shield, Target,
  Smartphone, Clock, TrendingUp, AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Toggle } from "@/components/ui/Toggle"
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  CartesianGrid, Tooltip, Cell,
} from "recharts"
import { useEngine } from "@/hooks/useEngine"
import { useTimerStore } from "@/store/timerStore"
import { useBlockingStore } from "@/store/blockingStore"
import { inMemoryStorage, profile } from "@/adapters/storage/InMemoryStorageAdapter"
import { trackingAdapter } from "@/adapters/tracking/WebTrackingAdapter"
import { notificationAdapter } from "@/adapters/notifications/WebNotificationAdapter"
import { reportError } from "@/lib/errors/AppError"
import { format, subDays } from "date-fns"
import { cn } from "@/lib/utils"
import type { Platform } from "@/core/types"

const COLORS = [
  "#ef4444", "#ec4899", "#3b6ef0", "#f59e0b", "#10b981", "#8b5cf6",
]

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function DashboardPageInner() {
  const engine = useEngine()
  const timerStore = useTimerStore()
  const blockingStore = useBlockingStore()

  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [focusActive, setFocusActive] = useState(false)
  const [focusDuration, setFocusDuration] = useState(25)
  const [focusSelected, setFocusSelected] = useState<Set<string>>(new Set())
  const [startingFocus, setStartingFocus] = useState(false)

  // ---- Load platforms ----
  useEffect(() => {
    inMemoryStorage.listPlatforms().then(setPlatforms).catch(console.error)
  }, [])

  // ---- Tick timer UI ----
  useEffect(() => {
    const active = timerStore.sessions.find((s) => s.isRunning)
    if (!active) return
    const id = setInterval(() => timerStore.tick(), 1000)
    return () => clearInterval(id)
  }, [timerStore.sessions, timerStore])

  // ---- Periodic engine evaluation ----
  useEffect(() => {
    engine.evaluate()
    const id = setInterval(() => engine.evaluate(), 10_000)
    return () => clearInterval(id)
  }, [engine])

  // ---- Focus active state (polls storage) ----
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const session = await inMemoryStorage.getActiveFocusSession()
        if (cancelled) return
        const active = !!(session && new Date(session.endsAt) > new Date())
        setFocusActive(active)
      } catch {
        // ignore
      }
    }
    check()
    const id = setInterval(check, 2_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [engine.lastEvaluated])

  // ---- Compute today's usage from engine accumulator ----
  const today = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }, [])

  const totalUsedToday = useMemo(() => {
    if (!platforms.length) return 0
    let total = 0
    for (const p of platforms) {
      total += engine.accumulator.getMinutes(profile.id, p.id, today)
    }
    return Math.round(total)
  }, [engine, platforms, today])

  const totalLimitToday = platforms.reduce((s, p) => s + p.dailyLimitMinutes, 0)
  const remaining = Math.max(0, totalLimitToday - totalUsedToday)

  // ---- Weekly data for chart ----
  const weeklyData = useMemo(() => {
    if (!platforms.length) return []
    const days: { day: string; minutes: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i)
      let total = 0
      for (const p of platforms) {
        total += engine.accumulator.getMinutes(profile.id, p.id, d)
      }
      days.push({ day: format(d, "EEE"), minutes: Math.round(total) })
    }
    return days
  }, [engine, platforms])

  const avgDaily = weeklyData.length
    ? Math.round(weeklyData.reduce((s, d) => s + d.minutes, 0) / weeklyData.length)
    : 0

  // ---- Engine blocking results ----
  const { blockedCount, limitBreaches } = useMemo(() => {
    if (!engine.lastResult) return { blockedCount: 0, limitBreaches: 0 }
    let blocked = 0
    let breaches = 0
    for (const [, decision] of engine.lastResult.decisions) {
      if (decision.isBlocked) {
        blocked++
        if (decision.reason?.type === "DAILY_LIMIT_EXCEEDED") breaches++
      }
    }
    return { blockedCount: blocked, limitBreaches: breaches }
  }, [engine.lastResult])

  // ---- Focus Mode handlers ----
  function toggleFocusPlatform(id: string) {
    setFocusSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleStartFocus() {
    if (focusSelected.size === 0 || startingFocus) return
    setStartingFocus(true)
    try {
      void await inMemoryStorage.startFocusSession({
        platformIds: Array.from(focusSelected),
        durationMinutes: focusDuration,
      })
      notificationAdapter.notifyFocusStart(focusDuration)
      engine.evaluate()
    } catch (e) {
      reportError(e)
    } finally {
      setStartingFocus(false)
    }
  }

  async function handleEndFocus() {
    const activeSession = await inMemoryStorage.getActiveFocusSession()
    if (activeSession) {
      await inMemoryStorage.endFocusSession(activeSession.id)
      notificationAdapter.notifyFocusEnd()
      engine.evaluate()
    }
  }

  async function handleToggleNamaz() {
    const settings = await inMemoryStorage.getNamazSettings()
    if (settings) {
      await inMemoryStorage.updateNamazSettings({ isEnabled: !settings.isEnabled })
      engine.evaluate()
    }
  }

  const [namazEnabled, setNamazEnabled] = useState(false)

  // Sync namazEnabled with storage when engine re-evaluates
  useEffect(() => {
    inMemoryStorage.getNamazSettings().then((s) => {
      if (s) setNamazEnabled(s.isEnabled)
    }).catch(() => {})
  }, [engine.lastEvaluated])

  // ---- Platform rows for usage bars ----
  const platformRows = useMemo(() => {
    return platforms.map((p, i) => {
      const used = engine.accumulator.getMinutes(profile.id, p.id, today)
      const pct = p.dailyLimitMinutes > 0 ? Math.min(100, Math.round((used / p.dailyLimitMinutes) * 100)) : 0
      const blockInfo = blockingStore.blocks[p.id]
      return { id: p.id, name: p.name, used, limit: p.dailyLimitMinutes, pct, color: COLORS[i % COLORS.length], blockInfo }
    })
  }, [platforms, engine, today, blockingStore.blocks])

  // ---- Quick timer state ----
  const [timerPlatforms, setTimerPlatforms] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    inMemoryStorage.listPlatforms().then((plats) =>
      setTimerPlatforms(plats.filter((p) => p.category === "Social" || p.category === "Video").map((p) => ({ id: p.id, name: p.name })))
    ).catch(() => {})
  }, [platforms])

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex items-center gap-2">
          {limitBreaches > 0 && (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {limitBreaches} breach{limitBreaches !== 1 ? "s" : ""}
            </Badge>
          )}
          <Badge variant={focusActive ? "brand" : "default"}>
            {focusActive ? "Focus Active" : "Focus Off"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">

          {/* ================================================================
              STATS ROW
              ================================================================ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Timer} label="Today's usage" value={`${totalUsedToday} min`} sub={`${remaining} min remaining`} accent="brand" />
            <StatCard icon={TrendingDown} label="Avg daily" value={`${avgDaily} min`} sub="Last 7 days" accent="success" />
            <StatCard icon={Flame} label="Limit breaches" value={String(limitBreaches)} sub={limitBreaches === 0 ? "All clear" : "Keep it up"} accent={limitBreaches > 0 ? "danger" : "success"} />
            <StatCard icon={Shield} label="Blocked now" value={String(blockedCount)} sub={blockedCount > 0 ? "Platforms restricted" : "No blocks active"} accent={blockedCount > 0 ? "danger" : "brand"} />
          </div>

          {/* ================================================================
              WEEKLY CHART
              ================================================================ */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-6 pb-4">
              <h3 className="text-base font-semibold text-slate-900">Weekly Overview</h3>
              <p className="text-sm text-slate-500 mt-0.5">Minutes per day — last 7 days</p>
            </div>
            <div className="px-6 pb-4">
              {weeklyData.length === 0 ? (
                <EmptyState message="No usage data yet. Start tracking to see your weekly pattern." />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
                      <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {weeklyData.map((_entry, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* ================================================================
              PLATFORM USAGE BARS
              ================================================================ */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-6 pb-4">
              <h3 className="text-base font-semibold text-slate-900">Platforms</h3>
              <p className="text-sm text-slate-500 mt-0.5">Today's usage vs. daily limit</p>
            </div>
            {platformRows.length === 0 ? (
              <div className="px-6 pb-6">
                <EmptyState message="No platforms configured. Add platforms to start tracking." />
              </div>
            ) : (
              <div className="px-6 pb-6 space-y-5">
                {platformRows.map((p) => (
                  <div key={p.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="text-sm font-medium text-slate-700">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm tabular-nums text-slate-600">
                          <span className="font-medium text-slate-900">{Math.round(p.used)}</span>
                          {" / "}{p.limit} min
                        </span>
                        {p.blockInfo?.status === "blocked" && (
                          <Badge variant="danger">Blocked</Badge>
                        )}
                      </div>
                    </div>
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          p.pct >= 100 ? "bg-red-500" : p.pct >= 70 ? "bg-amber-500" : "bg-brand-500"
                        )}
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ================================================================
            RIGHT COLUMN
            ================================================================ */}
        <div className="space-y-6">

          {/* ---- Focus Mode ---- */}
          {focusActive ? (
            <FocusActiveCard onEnd={handleEndFocus} />
          ) : (
            <FocusConfigCard
              platforms={platforms}
              duration={focusDuration}
              onDurationChange={setFocusDuration}
              selected={focusSelected}
              onToggle={toggleFocusPlatform}
              onStart={handleStartFocus}
              starting={startingFocus}
            />
          )}

          {/* ---- Namaz Mode ---- */}
          <NamazModeCard
            enabled={namazEnabled}
            onToggle={handleToggleNamaz}
          />

          {/* ---- Quick Timer ---- */}
          <QuickTimerCard platforms={timerPlatforms} />
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// Sub-components
// ===========================================================================

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: any
  label: string
  value: string
  sub: string
  accent: "brand" | "success" | "warning" | "danger"
}) {
  const bg = { brand: "bg-brand-50", success: "bg-success-500/10", warning: "bg-warning-500/10", danger: "bg-danger-500/10" }[accent]
  const text = { brand: "text-brand-600", success: "text-success-600", warning: "text-warning-600", danger: "text-danger-600" }[accent]

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center`}>
          <Icon className={`h-3.5 w-3.5 ${text}`} />
        </div>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 mb-3">
        <TrendingUp className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}

function FocusActiveCard({ onEnd }: { onEnd: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-brand-600 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-white" />
          <span className="text-white font-semibold text-sm">Focus Active</span>
        </div>
      </div>
      <div className="px-5 py-6 text-center">
        <p className="text-sm text-slate-600 mb-1">Blocking all distractions</p>
        <p className="text-xs text-slate-400 mb-4">Stay focused — session expires automatically</p>
        <Button variant="outline" size="sm" onClick={onEnd}>
          End Session
        </Button>
      </div>
    </div>
  )
}

function FocusConfigCard({
  platforms, duration, onDurationChange, selected, onToggle, onStart, starting,
}: {
  platforms: Platform[]
  duration: number
  onDurationChange: (d: number) => void
  selected: Set<string>
  onToggle: (id: string) => void
  onStart: () => void
  starting: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="p-5 pb-4">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Target className="h-4 w-4 text-brand-600" />
          Focus Mode
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">Block platforms for deep work</p>
      </div>
      <div className="px-5 pb-5 space-y-4">
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block">Duration</label>
          <div className="flex gap-2">
            {[25, 50, 90].map((m) => (
              <button key={m} type="button" onClick={() => onDurationChange(m)}
                className={cn("flex-1 text-xs py-2 rounded-lg border transition-colors",
                  duration === m ? "border-brand-600 bg-brand-50 text-brand-700 font-medium" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                {m < 60 ? `${m}m` : `${m / 60}h`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block">Block ({selected.size} selected)</label>
          <div className="flex flex-wrap gap-1.5">
            {platforms.map((p) => (
              <button key={p.id} type="button" onClick={() => onToggle(p.id)}
                className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                  selected.has(p.id) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <Button className="w-full" size="sm" onClick={onStart} disabled={selected.size === 0 || starting}>
          {starting ? "Starting…" : "Start Focus Session"}
        </Button>
      </div>
    </div>
  )
}

function NamazModeCard({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="p-5 pb-4">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-brand-600" />
          Namaz Mode
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">Auto-pause at prayer times</p>
      </div>
      <div className="px-5 pb-5">
        <Toggle checked={enabled} onCheckedChange={onToggle} label="Enabled" />
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
  )
}

function QuickTimerCard({ platforms }: { platforms: { id: string; name: string }[] }) {
  const { sessions, tick } = useTimerStore()
  const [selected, setSelected] = useState("")
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const active = sessions.find((s) => s.isRunning)
    if (!active) return
    const id = setInterval(() => tick(), 1000)
    return () => clearInterval(id)
  }, [sessions, tick])

  const active = sessions.find((s) => s.isRunning)

  if (active) {
    return (
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-5 pb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand-600" />
            Quick Timer
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">Track a platform session</p>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{active.platformName}</span>
            <span className="text-sm font-mono text-slate-600 tabular-nums">{formatElapsed(active.elapsedSec)}</span>
          </div>
          <Button variant="danger" size="sm" className="w-full" onClick={() => useTimerStore.getState().stopSession(active.id)}>
            Stop Timer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="p-5 pb-4">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand-600" />
          Quick Timer
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">Track a platform session</p>
      </div>
      <div className="px-5 pb-5 space-y-3">
        <select
          value={selected}
          onChange={(e) => { setSelected(e.target.value); setStarted(false) }}
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
          disabled={!selected || started}
          onClick={() => {
            const plat = platforms.find((p) => p.id === selected)
            if (plat) { trackingAdapter.startSession(plat.id, plat.name); setStarted(true) }
          }}
        >
          {started ? "Running…" : "Start Timer"}
        </Button>
      </div>
    </div>
  )
}

export default DashboardPageInner
