// ==========================================================================
// Analytics Page — 7-day usage breakdown per platform.
// ==========================================================================

import { useState, useEffect } from "react"
import { TrendingUp, Target, Flame } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  CartesianGrid, Tooltip,
} from "recharts"
import { format, subDays } from "date-fns"
import { inMemoryStorage } from "@/adapters/storage/InMemoryStorageAdapter"
import { UsageAccumulator } from "@/core/engine/UsageAccumulator"
import type { Platform, UsageLog } from "@/core/types"

const COLORS = [
  "#3b6ef0", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4",
]

interface DayData {
  day: string
  minutes: number
  limit: number
  date: string
}

function AnalyticsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [weeklyData, setWeeklyData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [plats, logs] = await Promise.all([
          inMemoryStorage.listPlatforms(),
          inMemoryStorage.getUsageLogs(new Date(0), new Date()),
        ])
        if (cancelled) return
        setPlatforms(plats)

        const acc = new UsageAccumulator()
        acc.ingest("user-1", logs as readonly UsageLog[])

        const days: DayData[] = []
        for (let i = 6; i >= 0; i--) {
          const date = subDays(new Date(), i)
          const dayStr = format(date, "yyyy-MM-dd")
          const dayDate = new Date(dayStr + "T00:00:00Z")

          let totalMinutes = 0
          for (const p of plats) {
            totalMinutes += acc.getMinutes("user-1", p.id, dayDate)
          }
          totalMinutes = Math.round(totalMinutes * 10) / 10

          const limitMinutes = plats.reduce((sum, p) => sum + p.dailyLimitMinutes, 0)

          days.push({
            day: format(date, "EEE"),
            minutes: totalMinutes,
            limit: limitMinutes,
            date: dayStr,
          })
        }
        setWeeklyData(days)
        setLoading(false)
      } catch {
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const platformBreakdown = (() => {
    if (!platforms.length) return []
    return platforms
      .map((p, i) => ({
        id: p.id,
        name: p.name,
        usedToday: 0,
        dailyLimitMinutes: p.dailyLimitMinutes,
        color: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.usedToday - a.usedToday)
  })()

  const totalToday = platformBreakdown.reduce((sum, p) => sum + p.usedToday, 0)
  const totalWeek = weeklyData.reduce((sum, d) => sum + d.minutes, 0)
  const avgDaily = totalWeek / 7
  const mostUsed = platformBreakdown[0]

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="h-5 w-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Analytics</h2>
        <p className="text-sm text-slate-500 mt-0.5">Your usage patterns across platforms</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Today" value={`${Math.round(totalToday)} min`} sub="Total usage" accent="brand" />
        <StatCard icon={Target} label="Weekly total" value={`${Math.round(totalWeek)} min`} sub="Last 7 days" accent="success" />
        <StatCard icon={Flame} label="Daily average" value={`${Math.round(avgDaily)} min`} sub="Per day" accent="warning" />
        <StatCard icon={TrendingUp} label="Top platform" value={mostUsed?.name ?? "—"} sub="Most used" accent="brand" />
      </div>

      {/* Weekly Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-1">Weekly Overview</h3>
        <p className="text-sm text-slate-500 mb-4">Total minutes per day</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
              <Bar dataKey="minutes" fill="#3b6ef0" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-Platform Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-1">Platforms</h3>
        <p className="text-sm text-slate-500 mb-4">Daily limits for managed platforms</p>
        <div className="space-y-4">
          {platforms.map((p, i) => {
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-medium text-slate-700">{p.name}</span>
                  </div>
                  <span className="text-xs tabular-nums font-medium text-slate-600">
                    {p.dailyLimitMinutes} min limit
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: "0%" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

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

export default AnalyticsPage
