// ==========================================================================
// Analytics Page — 7-day usage breakdown per platform.
// All stats computed via UsageAccumulator from real usage logs.
// ==========================================================================

import { useState, useEffect, useMemo } from "react"
import { TrendingUp, Target, Flame, AlertCircle } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  CartesianGrid, Tooltip, Cell,
} from "recharts"
import { format, subDays } from "date-fns"
import { inMemoryStorage, profile } from "@/adapters/storage/InMemoryStorageAdapter"
import { useEngine } from "@/hooks/useEngine"
import { cn } from "@/lib/utils"
import type { Platform } from "@/core/types"

const COLORS = [
  "#3b6ef0", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4",
]

interface DayData {
  day: string
  minutes: number
  limit: number
}

// ===========================================================================
// Stat card
// ===========================================================================

function StatCard({ icon: Icon, label, value, sub, accent }: {
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

// ===========================================================================
// Component
// ===========================================================================

function AnalyticsPage() {
  const engine = useEngine()
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ---- Load platforms once ----
  useEffect(() => {
    inMemoryStorage.listPlatforms()
      .then(setPlatforms)
      .catch(() => setError("Could not load platforms."))
      .finally(() => setLoading(false))
  }, [])

  // ---- Trigger engine evaluation to rebuild accumulator ----
  useEffect(() => {
    engine.evaluate()
  }, [engine])

  // ---- Today's date (midnight) for accumulator queries ----
  const today = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }, [])

  // ---- Computed: platform usage broken down per platform ----
  const platformBreakdown = useMemo(() => {
    if (!platforms.length) return []
    return platforms
      .map((p, i) => {
        const usedToday = engine.accumulator.getMinutes(profile.id, p.id, today)
        const pct = p.dailyLimitMinutes > 0
          ? Math.min(100, Math.round((usedToday / p.dailyLimitMinutes) * 100))
          : 0
        return {
          id: p.id,
          name: p.name,
          usedToday,
          dailyLimitMinutes: p.dailyLimitMinutes,
          pct,
          color: COLORS[i % COLORS.length],
        }
      })
      .sort((a, b) => b.usedToday - a.usedToday)
  }, [platforms, engine, today])

  // ---- Computed: summary statistics ----
  const totalToday = useMemo(() =>
    platformBreakdown.reduce((s, p) => s + p.usedToday, 0),
    [platformBreakdown]
  )

  const weeklyData = useMemo(() => {
    const days: DayData[] = []
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i)
      const dayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      let total = 0
      for (const p of platforms) {
        total += engine.accumulator.getMinutes(profile.id, p.id, dayDate)
      }
      const limit = platforms.reduce((s, p) => s + p.dailyLimitMinutes, 0)
      days.push({
        day: format(d, "EEE"),
        minutes: Math.round(total * 10) / 10,
        limit,
      })
    }
    return days
  }, [platforms, engine])

  const avgDaily = useMemo(() => {
    const sum = weeklyData.reduce((s, d) => s + d.minutes, 0)
    return weeklyData.length ? Math.round((sum / weeklyData.length) * 10) / 10 : 0
  }, [weeklyData])

  const mostUsed = platformBreakdown[0] ?? null

  // =========================================================================
  // RENDER
  // =========================================================================

  if (error) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-danger-500/10 mb-3">
          <AlertCircle className="h-5 w-5 text-danger-600" />
        </div>
        <h3 className="text-base font-medium text-slate-900 mb-1">Something went wrong</h3>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="h-5 w-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Analytics</h2>
        <p className="text-sm text-slate-500 mt-0.5">Your usage patterns across platforms</p>
      </div>

      {/* No platforms at all */}
      {platforms.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
            <TrendingUp className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">No platforms configured yet.</p>
          <p className="text-xs text-slate-400 mt-1">Add platforms in the Platforms section to start tracking.</p>
        </div>
      ) : (
        <>
          {/* ================================================================
              SUMMARY STATS
              ================================================================ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={TrendingUp} label="Today"
              value={`${Math.round(totalToday)} min`}
              sub={totalToday === 0 ? "No usage yet" : "Total usage"}
              accent="brand"
            />
            <StatCard
              icon={Target} label="Weekly total"
              value={`${Math.round(weeklyData.reduce((s, d) => s + d.minutes, 0))} min`}
              sub="Last 7 days"
              accent="success"
            />
            <StatCard
              icon={Flame} label="Daily average"
              value={`${avgDaily} min`}
              sub="Per day"
              accent="warning"
            />
            <StatCard
              icon={TrendingUp} label="Top platform"
              value={mostUsed?.name ?? "—"}
              sub={mostUsed ? `${Math.round(mostUsed.usedToday)} min today` : "No data yet"}
              accent="brand"
            />
          </div>

          {/* ================================================================
              WEEKLY CHART
              ================================================================ */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Weekly Overview</h3>
            <p className="text-sm text-slate-500 mb-4">Total minutes per day — last 7 days</p>

            {weeklyData.every((d) => d.minutes === 0) ? (
              <div className="text-center py-12">
                <Flame className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No usage data for the past week.</p>
                <p className="text-xs text-slate-400 mt-1">Data will appear as you use social platforms.</p>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
                      formatter={(v: any) => [`${v} min`, "Usage"]}
                    />
                    <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {weeklyData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ================================================================
              PER-PLATFORM BREAKDOWN (real data)
              ================================================================ */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Platform Breakdown</h3>
            <p className="text-sm text-slate-500 mb-6">Today's usage vs. daily limit per platform</p>

            {totalToday === 0 ? (
              <div className="text-center py-10">
                <TrendingUp className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No usage recorded today.</p>
                <p className="text-xs text-slate-400 mt-1">Platform usage will appear once tracking data is collected.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {platformBreakdown.map((p) => (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="text-sm font-medium text-slate-700">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm text-slate-500 tabular-nums">
                          <span className="font-medium text-slate-900">{Math.round(p.usedToday)}</span>
                          {" / "}{p.dailyLimitMinutes} min
                        </span>
                        {p.usedToday > 0 && (
                          <span className={cn(
                            "text-xs font-medium px-1.5 py-0.5 rounded",
                            p.pct >= 100 ? "bg-red-50 text-red-600" : p.pct >= 70 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                          )}>
                            {p.pct}%
                          </span>
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
        </>
      )}
    </div>
  )
}

export default AnalyticsPage
