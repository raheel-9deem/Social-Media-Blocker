import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import LandingPage from "@/pages/LandingPage"
import LoginPage from "@/pages/LoginPage"
import SignupPage from "@/pages/SignupPage"
import OnboardingPage from "@/pages/OnboardingPage"
import AppLayout from "@/components/layout/AppLayout"
import DashboardPage from "@/pages/DashboardPage"
import SettingsShell from "@/pages/SettingsShell"
import { ErrorBoundary } from "@/components/ui/Spinner"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  },
})

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            {/* Protected (App shell) */}
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route
                path="platforms"
                element={<PlaceholderRoute title="Platforms" />}
              />
              <Route
                path="tracker"
                element={<PlaceholderRoute title="Tracker" />}
              />
              <Route
                path="focus"
                element={<PlaceholderRoute title="Focus Mode" />}
              />
              <Route
                path="analytics"
                element={<PlaceholderRoute title="Analytics" />}
              />
              <Route
                path="schedule"
                element={<PlaceholderRoute title="Scheduled Blocks" />}
              />
              <Route
                path="namaz"
                element={<PlaceholderRoute title="Namaz Mode" />}
              />
              <Route path="settings" element={<SettingsShell />} />
              <Route
                path="*"
                element={<Navigate to="/app" replace />}
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
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
