// Design tokens used both in JS (className builder) and as CSS custom-properties.
// Keep these in sync with src/index.css.

export const colors = {
  brand: {
    50: "#f0f4ff",
    100: "#dbe4ff",
    200: "#b9cbfe",
    300: "#8aadfc",
    400: "#5a8cf7",
    500: "#3b6ef0",
    600: "#2a54d8",
    700: "#2241ad",
    800: "#1e3690",
    900: "#1a2f77",
  },
  slate: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },
  success: { 500: "#22c55e", 600: "#16a34a" },
  warning: { 500: "#f59e0b", 600: "#d97706" },
  danger: { 500: "#ef4444", 600: "#dc2626" },
}

export const radius = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
}

export const shadows = {
  sm: "0 1px 2px rgba(0,0,0,0.4)",
  md: "0 4px 6px -1px rgba(0,0,0,0.4)",
  lg: "0 10px 15px -3px rgba(0,0,0,0.4)",
}

export function classNames(obj: Record<string, boolean>): string {
  return Object.entries(obj)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(" ")
}
