// ==========================================================================
// Platforms Page — manage tracked platforms, set daily limits, view status.
// ==========================================================================

import { useState, useEffect } from "react"
import { Plus, Trash2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { useBlockingStore } from "@/store/blockingStore"
import { inMemoryStorage } from "@/adapters/storage/InMemoryStorageAdapter"
import { notificationAdapter } from "@/adapters/notifications/WebNotificationAdapter"
import { reportError } from "@/lib/errors/AppError"
import { cn } from "@/lib/utils"
import type { Platform } from "@/core/types"

const PLATFORM_COLORS = [
  "#ef4444", "#ec4899", "#3b6ef0", "#f59e0b", "#10b981",
  "#8b5cf6", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
]

function PlatformsPage() {
  const blockingStore = useBlockingStore()
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("Social")
  const [dailyLimit, setDailyLimit] = useState(30)

  const categories = ["Social", "Video", "News", "Gaming", "Productivity", "Other"]

  function loadPlatforms() {
    inMemoryStorage.listPlatforms().then((plats) => {
      setPlatforms(plats)
      setLoading(false)
    }).catch(reportError)
  }

  useEffect(() => {
    loadPlatforms()
    const unsub = inMemoryStorage.subscribeToChanges(loadPlatforms)
    return () => unsub()
  }, [])

  function openAdd() {
    setEditingId(null)
    setName("")
    setCategory("Social")
    setDailyLimit(30)
    setModalOpen(true)
  }

  function openEdit(plat: Platform) {
    setEditingId(plat.id)
    setName(plat.name)
    setCategory(plat.category)
    setDailyLimit(plat.dailyLimitMinutes)
    setModalOpen(true)
  }

  async function handleSubmit() {
    if (!name.trim()) return
    try {
      if (editingId) {
        const updated = await inMemoryStorage.updatePlatform(editingId, {
          name: name.trim(),
          category,
          dailyLimitMinutes: dailyLimit,
        })
        setPlatforms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        notificationAdapter.notify({ title: "Platform updated", message: `${name} limit set to ${dailyLimit} min/day`, type: "success" })
      } else {
        const created = await inMemoryStorage.addPlatform({
          name: name.trim(),
          category,
          dailyLimitMinutes: dailyLimit,
        })
        setPlatforms((prev) => [...prev, created])
        notificationAdapter.notify({ title: "Platform added", message: `${name} is now tracked`, type: "success" })
      }
      setModalOpen(false)
    } catch (e) {
      reportError(e)
      notificationAdapter.notify({ title: "Error", message: "Could not save platform", type: "error" })
    }
  }

  async function handleToggle(id: string) {
    try {
      const plat = platforms.find((p) => p.id === id)
      if (!plat) return
      await inMemoryStorage.updatePlatform(id, { isActive: !plat.isActive })
      notificationAdapter.notify({
        title: plat.isActive ? "Platform paused" : "Platform activated",
        message: plat.name,
        type: "info",
      })
    } catch (e) {
      reportError(e)
    }
  }

  async function handleDelete(id: string) {
    const plat = platforms.find((p) => p.id === id)
    try {
      await inMemoryStorage.removePlatform(id)
      setPlatforms((prev) => prev.filter((p) => p.id !== id))
      notificationAdapter.notify({ title: "Platform removed", message: plat?.name, type: "info" })
    } catch (e) {
      reportError(e)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="h-5 w-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Platforms</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {platforms.length} platforms tracked
          </p>
        </div>
        <Button onClick={openAdd} leftIcon={<Plus className="h-4 w-4" />}>
          Add Platform
        </Button>
      </div>

      <div className="space-y-3">
        {platforms.map((plat, i) => {
          const blockInfo = blockingStore.blocks[plat.id]
          const color = PLATFORM_COLORS[i % PLATFORM_COLORS.length]
          const isBlocked = blockInfo?.status === "blocked"

          return (
            <Card key={plat.id} className={cn(!plat.isActive && "opacity-50")}>
              <div className="flex items-center gap-4 p-4">
                <div className="flex items-center gap-1 text-slate-400 cursor-grab">
                  <GripVertical className="h-4 w-4" />
                </div>

                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {plat.name}
                    </span>
                    {isBlocked && (
                      <Badge variant="danger">Blocked</Badge>
                    )}
                    {!plat.isActive && (
                      <Badge variant="default">Paused</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-500">{plat.category}</span>
                    <span className="text-xs text-slate-400">
                      {plat.dailyLimitMinutes} min/day
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(plat)}
                    aria-label="Edit"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18.375 2.625a1.875 1.875 0 112.652 2.652L15.75 12.36" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggle(plat.id)}
                    aria-label={plat.isActive ? "Pause" : "Activate"}
                  >
                    {plat.isActive ? (
                      <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(plat.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-danger-500" />
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingId ? "Edit Platform" : "Add Platform"}
        description={editingId ? "Update limit and category" : "Track a new platform"}
      >
        <div className="space-y-4">
          <Input
            label="Platform name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. X (Twitter)"
          />
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    category === cat
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Daily limit: <span className="text-brand-600">{dailyLimit}</span> min
            </label>
            <input
              type="range"
              min={5}
              max={240}
              step={5}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
              <span>5 min</span>
              <span>240 min</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {editingId ? "Save" : "Add"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PlatformsPage
