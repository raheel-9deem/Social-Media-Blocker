import { useMemo } from "react"
import { Play, Square } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { Progress } from "@/components/ui/Progress"
import { Toggle } from "@/components/ui/Toggle"
import {
  Timer,
  Target,
  Smartphone,
  TrendingDown,
  Flame,
  Shield,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { useBlockingStore } from "@/store/blockingStore"
import { format } from "date-fns"
import { useEffect } from "react"

// ---- Mock data (no real backend yet) ----
const TODAY_USAGE = 147 // minutes used today out of ~240 available (6h)
const TOTAL_AVAILABLE = 240
const REMAINING = TOTAL_AVAILABLE - TODAY_USAGE

const platforms = [
  { id: "yt", name: "YouTube", used: 62, limit: 90, color: "#ef4444", category: "Video" },
  { id: "ig", name: "Instagram", used: 45, limit: 60, color: "#ec4899", category: "Social" },
  { id: "tt", name: "TikTok", used: 30, limit: 45, color: "#000000", category: "Video" },
  { id: "tw", name: "Twitter", used: 10, limit: 45, color: "#3b6ef0", category: "Social" },
]

// Set initial blocking status
// Set initial blocking status
function DashboardPageContent() {
  const blockingStore = useBlockingStore()

  // Simulate some blocked platforms based on mock data
  const blocks = useMemo(() => {
    const result: Record<string, { status: string; reason: string | null; unblockAt: string | null; activeRules: string[] }> = {}
    platforms.forEach((p) => {
      const share = p.used / p.limit
      if (share >= 0.95) {
        result[p.id] = {
          status: "blocked" as const,
          reason: "Daily limit reached",
          unblockAt: null,
          activeRules: ["DAILY_LIMIT"],
        }
      } else if (share >= 0.8) {
        result[p.id] = {
          status: "warning" as const,
          reason: "Approaching limit",
          unblockAt: null,
          activeRules: [],
        }
      } else {
        result[p.id] = {
          status: "allowed" as const,
          reason: null,
          unblockAt: null,
          activeRules: [],
        }
      }
    })
    return result
  }, [])

  useEffect(() => {
    blockingStore.setAllBlocks(blocks)
  }, [blocks, blockingStore])

  const today = useMemo(() => new Date(), [])

  const weekData = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today)
      day.setDate(day.getDate() - i)
      // Deterministic: vary by day-of-week + day-of-month
      const noise = ((day.getDay() + day.getDate()) % 5) * 10 + 40
      days.push({
        day: format(day, "EEE"),
        minutes: i === 0 ? TODAY_USAGE : noise,
        limit: 240,
      })
    }
    return days
  }, [today])

  const focusActive = false

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {format(today, "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <Badge variant={focusActive ? "brand" : "default"}>
          {focusActive ? "Focus Active" : "Focus Off"}
        </Badge>
      </div>

      {/* Actually focus mode */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Main stats + Platform cards */}
        <div className="xl:col-span-2 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Timer}
              label="Today's usage"
              value={`${TODAY_USAGE} min`}
              sub={`${REMAINING} min remaining`}
              accent="brand"
            />
            <StatCard
              icon={TrendingDown}
              label="Avg daily"
              value="118 min"
              sub="-12% vs last week"
              accent="success"
            />
            <StatCard
              icon={Flame}
              label="Streak"
              value="4 days"
              sub="Within limits"
              accent="warning"
            />
            <StatCard
              icon={Shield}
              label="Breaches"
              value="0"
              sub="Clean today"
              accent="success"
            />
          </div>

          {/* Weekly chart */}
          <Card>
            <Card.Header>
              <Card.Title>Weekly Overview</Card.Title>
              <Card.Description>Minutes per day vs. your daily cap</Card.Description>
            </Card.Header>
            <Card.Content className="pb-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Bar
                      dataKey="minutes"
                      fill="#3b6ef0"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>

          {/* Platform usage/limits */}
          <Card>
            <Card.Header>
              <Card.Title>Today's Platforms</Card.Title>
              <Card.Description>Track usage across each platform</Card.Description>
            </Card.Header>
            <Card.Content>
              <div className="space-y-5">
                {platforms.map((p) => {
                  const pct = Math.round((p.used / p.limit) * 100)
                  const block = blocks[p.id]
                  return (
                    <div key={p.id} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="text-sm font-medium text-slate-700">
                            {p.name}
                          </span>
                          <Badge variant="default">{p.category}</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm tabular-nums text-slate-600">
                            <span className="font-medium text-slate-900">{p.used}</span>
                            {" / "}
                            {p.limit} min
                          </span>
                          {block?.status === "blocked" && (
                            <Badge variant="danger">Blocked</Badge>
                          )}
                          {block?.status === "warning" && (
                            <Badge variant="warning">Near limit</Badge>
                          )}
                        </div>
                      </div>
                      <Progress value={pct} color={pct >= 80 ? "danger" : pct >= 60 ? "warning" : undefined} />
                    </div>
                  )
                })}
              </div>
            </Card.Content>
            <Card.Footer>
              <Button variant="outline" size="sm">
                Manage platforms
              </Button>
            </Card.Footer>
          </Card>
        </div>

        {/* Right column: Focus Mode + Namaz Mode + Tracker */}
        <div className="space-y-6">
          {/* Focus Mode */}
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <Target className="h-4 w-4 text-brand-600" />
                Focus Mode
              </Card.Title>
              <Card.Description>
                Block all platforms for deep work sessions
              </Card.Description>
            </Card.Header>
            <Card.Content className="space-y-4">
              <Toggle
                checked={focusActive}
                onCheckedChange={(v) => console.log("Focus mode:", v)}
                label="Enabled"
              />
              {!focusActive ? (
                <>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Duration</label>
                    <div className="flex gap-2">
                      {[25, 50, 90].map((m) => (
                        <button
                          key={m}
                          className="flex-1 text-xs py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Block</label>
                    <div className="flex flex-wrap gap-1.5">
                      {platforms.map((p) => (
                        <Badge key={p.id} variant="brand" dismissible onDismiss={() => { }}>
                          {p.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full" size="sm" variant="primary">
                    Start Focus Session
                  </Button>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-600 mb-1">Focus session active</p>
                  <p className="text-xs text-slate-400">45 minutes remaining</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    leftIcon={<Square className="h-3.5 w-3.5" />}
                  >
                    End Session
                  </Button>
                </div>
              )}
            </Card.Content>
          </Card>

          {/* Namaz Mode */}
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-brand-600" />
                Namaz Mode
              </Card.Title>
              <Card.Description>
                Auto-pause social media at prayer windows
              </Card.Description>
            </Card.Header>
            <Card.Content className="space-y-4">
              <Toggle
                checked={false}
                onCheckedChange={(v) => console.log("Namaz mode:", v)}
                label="Enabled"
              />
              <div className="space-y-2.5">
                {[
                  { name: "Fajr", time: "5:12 AM" },
                  { name: "Dhuhr", time: "12:34 PM" },
                  { name: "Asr", time: "3:45 PM" },
                  { name: "Maghrib", time: "6:48 PM" },
                  { name: "Isha", time: "8:15 PM" },
                ].map(({ name, time }) => (
                  <div
                    key={name}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-slate-700">{name}</span>
                    <span className="text-slate-500 tabular-nums">{time}</span>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>

          {/* Quick Timer */}
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-brand-600" />
                Quick Timer
              </Card.Title>
              <Card.Description>
                Manually track a platform session
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <PlatformTimer />
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---- Sub-components ----

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
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
    <Card padding="md">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-md ${accentBg} flex items-center justify-center`}>
          <Icon className={`h-3.5 w-3.5 ${accentText}`} />
        </div>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </Card>
  )
}

function PlatformTimer() {
  const { startSession, stopSession, sessions } = useTimerStore()
  const active = sessions.find((s) => s.isRunning)

  return (
    <div className="space-y-3">
      <select
        className="w-full h-9 rounded-lg border border-slate-300 px-3 text-sm bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        defaultValue=""
      >
        <option value="" disabled>
          Select platform…
        </option>
        {platforms.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {active ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">{active.platformName}</span>
            <span className="text-xs font-mono text-slate-600 tabular-nums">
              {formatElapsed(active.elapsedSec)}
            </span>
          </div>
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            leftIcon={<Square className="h-3.5 w-3.5" />}
            onClick={() => stopSession(active.id)}
          >
            Stop Timer
          </Button>
        </div>
      ) : (
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          leftIcon={<Play className="h-3.5 w-3.5" />}
          onClick={() => startSession("yt", "YouTube")}
        >
          Start Timer
        </Button>
      )}
    </div>
  )
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export { PlatformTimer }

export default DashboardPageContent
