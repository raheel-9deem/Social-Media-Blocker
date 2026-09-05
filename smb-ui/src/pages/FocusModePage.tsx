// ==========================================================================
// Focus Mode Page — start/end focus sessions, select platforms.
// ==========================================================================

import { useState, useEffect } from "react"
import { Target, Play, Square, Timer as TimerIcon } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { inMemoryStorage } from "@/adapters/storage/InMemoryStorageAdapter"
import { notificationAdapter } from "@/adapters/notifications/WebNotificationAdapter"
import { reportError } from "@/lib/errors/AppError"
import { cn } from "@/lib/utils"
import type { Platform } from "@/core/types"

const DURATIONS = [25, 50, 90]

function formatRemaining(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function FocusModePage() {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [activeSession, setActiveSession] = useState<{
    id: string
    endsAt: string
    platformIds: string[]
  } | null>(null)
  const [duration, setDuration] = useState(50)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    inMemoryStorage.listPlatforms().then(setPlatforms).catch(console.error)
  }, [])

  useEffect(() => {
    if (!activeSession) return
    const tick = setInterval(() => {
      const remaining = Math.round((new Date(activeSession.endsAt).getTime() - Date.now()) / 1000)
      if (remaining <= 0) {
        setActiveSession(null)
        notificationAdapter.notifyFocusEnd()
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [activeSession])

  function togglePlatform(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleStart() {
    if (selectedIds.size === 0) {
      notificationAdapter.notify({ title: "Select platforms", message: "Choose at least one platform to block", type: "warning" })
      return
    }
    try {
      const session = await inMemoryStorage.startFocusSession({
        platformIds: Array.from(selectedIds),
        durationMinutes: duration,
      })
      setActiveSession({
        id: session.id,
        endsAt: session.endsAt,
        platformIds: session.platformIds,
      })
      notificationAdapter.notifyFocusStart(duration)
    } catch (e) {
      reportError(e)
    }
  }

  async function handleStop() {
    if (!activeSession) return
    try {
      await inMemoryStorage.endFocusSession(activeSession.id)
      setActiveSession(null)
      notificationAdapter.notifyFocusEnd()
    } catch (e) {
      reportError(e)
    }
  }

  if (activeSession) {
    const remaining = Math.max(0, Math.round((new Date(activeSession.endsAt).getTime() - Date.now()) / 1000))
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6">
        <h2 className="text-xl font-bold text-slate-900">Focus Mode</h2>
        <Card className="text-center py-10">
          <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <Target className="h-8 w-8 text-brand-600" />
          </div>
          <p className="text-sm text-slate-500 mb-2">Focus Session Active</p>
          <p className="text-5xl font-mono font-bold text-slate-900 tabular-nums tracking-wide mb-1">
            {formatRemaining(remaining)}
          </p>
          <p className="text-xs text-slate-400 mb-6">
            Blocking {activeSession.platformIds.length} platform{activeSession.platformIds.length !== 1 ? "s" : ""}
          </p>
          <div className="flex justify-center gap-2 mb-6">
            {activeSession.platformIds.map((pid, i) => {
              const plat = platforms.find((p) => p.id === pid)
              return (
                <Badge key={i} variant="brand">
                  {plat?.name ?? pid}
                </Badge>
              )
            })}
          </div>
          <Button variant="danger" onClick={handleStop} leftIcon={<Square className="h-4 w-4" />}>
            End Focus Session
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Focus Mode</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Block distracting platforms for deep work
        </p>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Session Configuration</Card.Title>
          <Card.Description>Choose duration and platforms to block</Card.Description>
        </Card.Header>
        <Card.Content className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Duration</label>
            <div className="flex gap-2">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setDuration(m)}
                  className={cn(
                    "flex-1 h-11 rounded-lg border text-sm font-medium transition-colors",
                    duration === m
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <TimerIcon className="h-3.5 w-3.5 mx-auto mb-1" />
                  {m < 60 ? `${m}m` : `${m / 60}h`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Platforms to block ({selectedIds.size} selected)
            </label>
            <div className="flex flex-wrap gap-2">
              {platforms.map((plat) => {
                const isSelected = selectedIds.has(plat.id)
                return (
                  <button
                    key={plat.id}
                    onClick={() => togglePlatform(plat.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                      isSelected
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {plat.name}
                  </button>
                )
              })}
            </div>
          </div>

          <Button
            className="w-full"
            size="default"
            onClick={handleStart}
            disabled={selectedIds.size === 0}
            leftIcon={<Play className="h-4 w-4" />}
          >
            Start Focus Session
          </Button>
        </Card.Content>
      </Card>
    </div>
  )
}

export default FocusModePage
