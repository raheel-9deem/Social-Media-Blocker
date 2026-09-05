# Social Media Blocker

A calm, minimal, and modern digital-wellbeing Chrome extension. No account, no database, no setup required.

> **Status:** MVP — Standalone Chrome extension with Focus Mode, Namaz Mode, and Analytics

---

## What It Does

| Feature | Description |
|---|---|
| **Smart Blocking** | Set daily time limits per platform. Automatically block when you hit your cap. |
| **Focus Mode** | Activate deep-work sessions that block selected platforms for a set duration. |
| **Namaz Mode** | Auto-pause social media during prayer windows (Fajr, Dhuhr, Asr, Maghrib, Isha). |
| **Clean Analytics** | Minimal, calm charts showing your usage patterns. |
| **Manual Timer** | Track platform sessions manually. |

### Supported Platforms
YouTube, Instagram, TikTok, Twitter / X, Facebook, Reddit

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + TypeScript 6 |
| **Build Tool** | Vite 8 |
| **Styling** | Tailwind CSS 4 |
| **State Management** | Zustand 5 |
| **Routing** | React Router 7 |
| **Charts** | Recharts |

---

## Architecture

The extension is fully self-contained. The entire React app runs inside the browser toolbar popup — no web app, no server, no account.

```
extension/                       ← THIS IS ALL YOU NEED
├── manifest.json                # Chrome Extension Manifest V3
├── background.js                # Service worker (heartbeat, state, blocking rules)
├── content.js                   # Content script — injects block overlay into pages
├── icons/                       # Extension icons (16/48/128)
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── index.html                   # Popup entry (built React app)
└── assets/
    └── index-[hash].js          # Bundled React app + styles
```

### How It Works

1. **Popup** — Click the extension icon in Chrome toolbar. A full React SPA opens with Dashboard, Analytics, Focus Mode, Namaz Mode, Tracker, Platforms, and Settings.
2. **Blocking** — When a platform is blocked, `background.js` + `content.js` inject a full-screen overlay on matching sites.
3. **Storage** — Data lives in memory during the session. No server, no sync, no account needed.

### Blocking Rules (Priority Order)

1. **Daily Limit** — Platform exceeded its daily time budget
2. **Focus Mode** — Active focus session is running
3. **Scheduled Blocks** — User-defined time window
4. **Namaz Mode** — Prayer window active

---

## Install for Users

1. Download or clone this repository
2. Open terminal in the project folder
3. Run:
   ```bash
   cd smb-ui
   npm install
   npm run build:extension
   ```
4. Open **chrome://extensions** in Chrome
5. Enable **Developer mode** (top-right toggle)
6. Click **Load unpacked**
7. Select the **`extension/`** folder

That's it. Click the extension icon in your toolbar to open the app.

> Note: After loading, if you change the code, run `npm run build:extension` again, then click **Reload** on the extension card in `chrome://extensions`.

---

## Development

```bash
cd smb-ui
npm install
npm run dev
```

Opens a dev server at `http://localhost:5173/` for UI development.

```bash
npm run build          # TypeScript check + Vite production build
npm run build:extension # Build + copy to extension/ folder
npm run preview        # Preview production build locally
npm run lint           # Run Oxlint
```

---

## Core Engine (`smb-ui/src/core/`)

Zero dependencies on React, Supabase, or any browser/Node API. Platform-independent domain logic.

| Module | Responsibility |
|---|---|
| `BlockingEvaluator` | Orchestrates all rules → returns per-platform decisions |
| `DailyLimitRule` | Checks daily time budget |
| `FocusModeRule` | Blocks during active Focus sessions |
| `ScheduledBlockRule` | Blocks during user-defined time windows |
| `NamazModeRule` | Blocks during prayer windows |
| `UsageAccumulator` | Aggregates usage logs into per-platform minute totals |
| `DailyResetManager` | Timezone-aware day boundary detection |

---

## License

MIT

---

*Made with ❤, by Raheel Nadeem*
