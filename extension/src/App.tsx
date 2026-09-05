// ==========================================================================
// App — Root component of the MediaBlocker popup UI.
//
// Uses HashRouter (not BrowserRouter) because Chrome extension popups
// run at chrome-extension://ID/index.html and don't have a real web
// server to handle pushState navigation. HashRouter uses URL hashes
// (e.g. #/app/platforms) which work correctly in the extension context.
//
// Route structure:
//   #/app           → Dashboard (default)
//   #/app/platforms → Manage tracked platforms
//   #/app/tracker   → Usage tracking
//   #/app/focus     → Focus Mode sessions
//   #/app/analytics → Usage analytics
//   #/app/namaz     → Namaz Mode settings
//   #/app/settings  → App settings
// ==========================================================================

import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import AppLayout from "@/components/layout/AppLayout"
import DashboardPage from "@/pages/DashboardPage"
import SettingsShell from "@/pages/SettingsShell"
import PlatformsPage from "@/pages/PlatformsPage"
import TrackerPage from "@/pages/TrackerPage"
import FocusModePage from "@/pages/FocusModePage"
import AnalyticsPage from "@/pages/AnalyticsPage"
import NamazPage from "@/pages/NamazPage"
import { ErrorBoundary } from "@/components/ui/Spinner"

/**
 * React Query client with sensible defaults for an offline-first extension:
 * - No refetch on window focus (popup opens/closes frequently)
 * - No retries (data is local, failures are immediate)
 * - 5-minute stale time to avoid unnecessary re-fetches
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  },
})

/**
 * Placeholder route component for features not yet implemented.
 * Shows a simple message instead of an empty page.
 */
function PlaceholderRoute({ title }: { title: string }) {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-sm text-slate-500">
        Backend logic and full feature flows will be added in the next phase.
      </p>
    </div>
  )
}

/**
 * Root App component — wraps everything in providers and routing.
 *
 * BUG FIX: Changed from BrowserRouter to HashRouter. BrowserRouter uses
 * the History API which doesn't work in Chrome extension popup context
 * (no server to handle pushState). HashRouter uses URL fragments (#/path)
 * which work correctly everywhere.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <ErrorBoundary>
          <Routes>
            {/* App shell — all authenticated routes */}
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="platforms" element={<PlatformsPage />} />
              <Route path="tracker" element={<TrackerPage />} />
              <Route path="focus" element={<FocusModePage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route
                path="schedule"
                element={<PlaceholderRoute title="Scheduled Blocks" />}
              />
              <Route path="namaz" element={<NamazPage />} />
              <Route path="settings" element={<SettingsShell />} />
              {/* Catch-all within /app → redirect to dashboard */}
              <Route
                path="*"
                element={<Navigate to="/app" replace />}
              />
            </Route>
            {/* Root → Dashboard */}
            <Route path="/" element={<Navigate to="/app" replace />} />
            {/* Global catch-all → Dashboard */}
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </ErrorBoundary>
      </HashRouter>
      {/* Toast notifications at the bottom of the popup */}
      <Toaster
        position="bottom-center"
        toastOptions={{
          classNames: {
            error: "bg-danger-50 text-danger-800 border border-danger-200",
            success: "bg-success-50 text-success-800 border border-success-200",
            warning: "bg-warning-50 text-warning-800 border border-warning-200",
            loading: "bg-white text-slate-700 border border-slate-200",
          },
        }}
      />
    </QueryClientProvider>
  )
}
