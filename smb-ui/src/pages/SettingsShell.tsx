import { useState } from "react"
import { Bell, Palette, Clock, Shield, User, Trash2 } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Toggle } from "@/components/ui/Toggle"
import { Badge } from "@/components/ui/Badge"

type Tab = "general" | "notifications" | "data" | "account"

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "general", label: "General", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "data", label: "Data", icon: Shield },
  { id: "account", label: "Account", icon: Trash2 },
]

function SettingsShell() {
  const [tab, setTab] = useState<Tab>("general")

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-slate-900 mb-1">Settings</h2>
      <p className="text-sm text-slate-500 mb-6">
        Manage your preferences, notifications, and account
      </p>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Sidebar tabs */}
        <Card className="flex sm:flex-col gap-0.5 p-1 self-start sm:w-48 shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full
                ${tab === id ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"}
              `}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </Card>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === "general" && <GeneralSettings />}
          {tab === "notifications" && <NotificationSettings />}
          {tab === "data" && <DataSettings />}
          {tab === "account" && <AccountSettings />}
        </div>
      </div>
    </div>
  )
}

function GeneralSettings() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>General</Card.Title>
        <Card.Description>Timezone, theme, and language preferences</Card.Description>
      </Card.Header>
      <Card.Content className="space-y-5">
        <Input label="Display name" placeholder="Your name" defaultValue="Sam N." />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Timezone
          </label>
          <select className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
            <option>Asia/Karachi (UTC+5)</option>
            <option>America/New_York (UTC-5)</option>
            <option>Europe/London (UTC+0)</option>
            <option>Asia/Dubai (UTC+4)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Language
          </label>
          <select className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
            <option>English</option>
            <option>Urdu</option>
            <option>Arabic</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Dark mode</p>
            <p className="text-xs text-slate-400">Switch between light and dark theme</p>
          </div>
          <Toggle checked={false} onCheckedChange={(v) => console.log("theme:", v)} />
        </div>
      </Card.Content>
      <Card.Footer>
        <Button size="sm">Save Changes</Button>
      </Card.Footer>
    </Card>
  )
}

function NotificationSettings() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Notifications</Card.Title>
        <Card.Description>Control what alerts you receive</Card.Description>
      </Card.Header>
      <Card.Content className="space-y-5">
        {[
          {
            label: "Daily summary",
            desc: "Get a recap of yesterday's usage",
            default: true,
          },
          {
            label: "Limit warnings",
            desc: "Alert when approaching 80% of your cap",
            default: true,
          },
          {
            label: "Focus reminders",
            desc: "Remind to start a Focus session if unused",
            default: false,
          },
          {
            label: "Namaz reminders",
            desc: "Reminder before each prayer window",
            default: false,
          },
        ].map(({ label, desc, default: checked }) => (
          <div
            key={label}
            className="flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-medium text-slate-700">{label}</p>
              <p className="text-xs text-slate-400">{desc}</p>
            </div>
            <Toggle checked={checked} onCheckedChange={() => { }} />
          </div>
        ))}
      </Card.Content>
      <Card.Footer>
        <Button size="sm">Save Changes</Button>
      </Card.Footer>
    </Card>
  )
}

function DataSettings() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Data & Privacy</Card.Title>
        <Card.Description>Export or clear your data</Card.Description>
      </Card.Header>
      <Card.Content className="space-y-5">
        <div>
          <p className="text-sm font-medium text-slate-700">Export usage data</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Download all your usage logs as a CSV file
          </p>
          <Button variant="outline" size="sm" className="mt-3">
            Export CSV
          </Button>
        </div>
        <div className="border-t border-slate-100 pt-5">
          <p className="text-sm font-medium text-slate-700">Clear all data</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Permanently delete all usage logs, settings, and analytics
          </p>
          <Button variant="danger" size="sm" className="mt-3">
            Clear Data
          </Button>
        </div>
      </Card.Content>
    </Card>
  )
}

function AccountSettings() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Account</Card.Title>
        <Card.Description>Manage your account and subscription</Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        <Input label="Email" type="email" value="user@example.com" readOnly />
        <Badge variant="brand">Free Plan</Badge>
        <p className="text-xs text-slate-400">
          MediaBlocker is free forever. No paid tiers planned for the near future.
        </p>
      </Card.Content>
      <Card.Footer>
        <Button variant="danger" size="sm">
          Delete Account
        </Button>
      </Card.Footer>
    </Card>
  )
}

export default SettingsShell
