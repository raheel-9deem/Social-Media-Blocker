import { create } from "zustand"

type SidebarState = "expanded" | "collapsed"

interface AppState {
  sidebarOpen: boolean
  sidebarState: SidebarState
  currentPath: string

  setSidebarOpen: (v: boolean) => void
  toggleSidebarState: () => void
  setCurrentPath: (p: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  sidebarState: "expanded",
  currentPath: "/app",

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebarState: () =>
    set((s) => ({
      sidebarState: s.sidebarState === "expanded" ? "collapsed" : "expanded",
    })),
  setCurrentPath: (currentPath) => set({ currentPath }),
}))
