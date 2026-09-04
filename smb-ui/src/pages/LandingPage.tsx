import { Link } from "react-router-dom"
import { Shield, Zap, BarChart3, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/Button"

const FEATURES = [
  {
    icon: Shield,
    title: "Smart Blocking",
    desc: "Set daily limits for each platform. Lock down when you’ve hit your cap — no more mindless scrolling.",
  },
  {
    icon: Zap,
    title: "Focus Mode",
    desc: "Activate deep work sessions. Block distracting platforms for a set duration to stay in flow.",
  },
  {
    icon: Smartphone,
    title: "Namaz Mode",
    desc: "Automatically pause social media during prayer times. Stay mindful of what matters most.",
  },
  {
    icon: BarChart3,
    title: "Clean Analytics",
    desc: "Minimal, calm charts that show your usage patterns — no guilt trips, just awareness.",
  },
] as const

function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex items-center px-6 sticky top-0 z-40">
        <div className="mx-auto w-full max-w-6xl flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-brand-600" />
            <span className="font-semibold text-slate-900">MediaBlocker</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 text-center">
        <Badge variant="brand" className="mb-6">
          Now in MVP
        </Badge>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.1]">
          Reclaim your attention,
          <br />
          <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
            one session at a time
          </span>
        </h1>
        <p className="mt-6 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          A calm, minimal tool that helps you set healthy boundaries with social media —
          without the noise, streaks, or gamification.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/signup">
            <Button size="lg">Start free</Button>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="lg">
              Log in
            </Button>
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-400">No credit card · Free forever</p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="animate-fade">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-brand-600" />
              </div>
              <Card.Title>{title}</Card.Title>
              <Card.Description>{desc}</Card.Description>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Card className="text-center py-12 px-8 bg-gradient-to-br from-brand-50 to-white border-brand-200">
          <h2 className="text-2xl font-bold text-slate-900">
            Ready to take control?
          </h2>
          <p className="mt-2 text-slate-500 max-w-md mx-auto">
            Join thousands reclaiming their screen time. Set up in under 2 minutes.
          </p>
          <Link to="/signup" className="mt-6 inline-block">
            <Button size="lg">Get started free</Button>
          </Link>
        </Card>
      </section>
    </div>
  )
}

import { Badge, Card } from "@/components/ui"
export default LandingPage
