// ==========================================================================
// Tracker Page — manual session timer for tracking platform usage.
// ==========================================================================

import { useState, useEffect, useCallback } from "react"
import { Play, Square, Clock, Timer } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { inMemoryStorage } from "@/adapters/storage/InMemoryStorageAdapter"
import { trackingAdapter } from "@/adapters/tracking/WebTrackingAdapter"
import { useTimerStore } from "@/store/timerStore"
import { format } from "date-fns"

function TrackerPage() {
  const { sessions, tick } = useTimerStore()
  const [platforms, setPlatforms] = useState<{ id: string; name: string; category: string }[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState("")

  const active = sessions.find((s) => s.isRunning)

  useEffect(() => {
    inMemoryStorage.listPlatforms().then(setPlatforms).catch(console.error)
  }, [])

  useEffect(() => {
    if (!active) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [active, tick])

  useEffect(() => {
    return () => trackingAdapter.stopTick()
  }, [])

  const handleStart = useCallback(async () => {
    if (!selectedPlatform) return
    const plat = platforms.find((p) => p.id === selectedPlatform)
    if (!plat) return
    await trackingAdapter.startSession(plat.id, plat.name)
  }, [selectedPlatform, platforms])

  const handleStop = useCallback(async () => {
    await trackingAdapter.stopSession()
  }, [])

  function formatElapsed(sec: number): string {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  const recentSessions = sessions.filter((s) => !s.isRunning).slice(0, 10)

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Tracker</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Manually track time spent on social platforms
        </p>
      </div>

      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-brand-600" />
            {active ? "Session in progress" : "Start a session"}
          </Card.Title>
          <Card.Description>
            {active ? "Track your time — stop when you're done" : "Pick a platform and start tracking"}
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          {active ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-slate-500">{active.platformName}</p>
              <p className="text-4xl font-mono font-bold text-slate-900 tabular-nums tracking-wide">
                {formatElapsed(active.elapsedSec)}
              </p>
              <p className="text-xs text-slate-400">
                Started {format(new Date(active.startedAt), "h:mm a")}
              </p>
              <Button
                variant="danger"
                size="default"
                onClick={handleStop}
                leftIcon={<Square className="h-4 w-4" />}
              >
                Stop Session
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Platform</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">Select a platform…</option>
                  {platforms
                    .filter((p) => p.category === "Social" || p.category === "Video")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
              <Button
                variant="primary"
                size="default"
                className="w-full"
                disabled={!selectedPlatform}
                leftIcon={<Play className="h-4 w-4" />}
                onClick={handleStart}
              >
                Start Tracking
              </Button>
            </div>
          )}
        </Card.Content>
      </Card>

      {recentSessions.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              Recent Sessions
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-sm text-slate-700">{s.platformName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 tabular-nums">
                      {formatElapsed(s.elapsedSec)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(s.startedAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  )
}

export default TrackerPage
