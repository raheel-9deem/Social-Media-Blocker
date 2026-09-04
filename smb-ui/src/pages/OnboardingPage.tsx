import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Clock, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Toggle } from "@/components/ui/Toggle"
import { Card } from "@/components/ui/Card"

type Step = 1 | 2 | 3

const STEPS: Array<{
  step: Step
  title: string
  subtitle: string
  body: string
  action: string
}> = [
  {
    step: 1,
    title: "Pick your platforms",
    subtitle: "Where do you spend most of your time?",
    body: "Select the social platforms you want to manage. We'll start with the most common ones.",
    action: "Next",
  },
  {
    step: 2,
    title: "Set daily limits",
    subtitle: "How much is healthy for you?",
    body: "Define a daily cap for each platform — be realistic, not restrictive. You can always change it.",
    action: "Next",
  },
  {
    step: 3,
    title: "Choose your modes",
    subtitle: "Optional but powerful",
    body: "Focus Mode blocks all platforms during deep-work sessions. Namaz Mode pauses use during prayers.",
    action: "Finish",
  },
]

const PLATFORMS = [
  { name: "YouTube", icon: "📺" },
  { name: "Instagram", icon: "📸" },
  { name: "TikTok", icon: "🎵" },
  { name: "Twitter / X", icon: "🐦" },
  { name: "Facebook", icon: "👤" },
  { name: "Reddit", icon: "🤖" },
] as const

function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<string[]>([])
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [focusMode, setFocusMode] = useState(false)
  const [namazMode, setNamazMode] = useState(false)

  const current = STEPS[step - 1]

  function togglePlatform(name: string) {
    setSelected((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name]
    )
    if (!limits[name]) setLimits((p) => ({ ...p, [name]: 60 }))
  }

  function handleNext() {
    if (step < 3) {
      setStep((s) => Math.min(3, (s + 1) as Step))
    } else {
      navigate("/app")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Progress */}
      <div className="h-1 bg-slate-200">
        <div
          className="h-full bg-brand-600 transition-all duration-500 ease-out"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-lg" padding="lg">
          {/* Step indicator */}
          <div className="flex justify-between mb-8">
            {STEPS.map((s) => (
              <div
                key={s.step}
                className="flex items-center gap-2"
              >
                <div
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${step >= s.step ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-400"}
                  `}
                >
                  {step > s.step ? "✓" : s.step}
                </div>
                {s.step < 3 && (
                  <div
                    className={`h-0.5 w-6 sm:w-12 transition-colors ${
                      step > s.step ? "bg-brand-600" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Platform selection */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{current.title}</h2>
              <p className="text-sm text-slate-500 mt-1">{current.subtitle}</p>
              <p className="text-sm text-slate-500 mt-3">{current.body}</p>
              <div className="grid grid-cols-2 gap-3 mt-6">
                {PLATFORMS.map(({ name, icon }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => togglePlatform(name)}
                    className={`
                      flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all
                      ${selected.includes(name)
                        ? "border-brand-500 bg-brand-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                      }
                    `}
                  >
                    <span className="text-xl">{icon}</span>
                    <span className="text-sm font-medium text-slate-700">{name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Limits */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{current.title}</h2>
              <p className="text-sm text-slate-500 mt-1">{current.subtitle}</p>
              <p className="text-sm text-slate-500 mt-3">{current.body}</p>
              <div className="space-y-5 mt-6">
                {selected.map((name) => (
                  <div key={name}>
                    <label className="flex justify-between text-sm font-medium text-slate-700 mb-2">
                      <span>{name}</span>
                      <span className="text-brand-600">{limits[name] ?? 60} min/day</span>
                    </label>
                    <input
                      type="range"
                      min={15}
                      max={180}
                      step={15}
                      value={limits[name] ?? 60}
                      onChange={(e) =>
                        setLimits((p) => ({ ...p, [name]: Number(e.target.value) }))
                      }
                      className="w-full accent-brand-600"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>15 min</span>
                      <span>180 min</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Modes */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{current.title}</h2>
              <p className="text-sm text-slate-500 mt-1">{current.subtitle}</p>
              <p className="text-sm text-slate-500 mt-3">{current.body}</p>
              <div className="space-y-4 mt-6">
                <Card className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-brand-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Focus Mode</p>
                      <p className="text-xs text-slate-500">
                        Block all platforms for a set duration
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={focusMode}
                    onCheckedChange={setFocusMode}
                  />
                </Card>
                <Card className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-brand-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Namaz Mode</p>
                      <p className="text-xs text-slate-500">
                        Pause social media during prayer windows
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={namazMode}
                    onCheckedChange={setNamazMode}
                  />
                </Card>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep((s) => Math.max(1, (s - 1) as Step))}
              >
                Back
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={handleNext}
              disabled={step === 1 && selected.length === 0}
            >
              {current.action}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default OnboardingPage
