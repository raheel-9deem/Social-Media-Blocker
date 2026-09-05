// ==========================================================================
// Entry Point — bootstraps the React app into the #root element.
//
// This file is loaded by index.html and mounts the App component.
// It imports the global CSS (Tailwind + custom styles) which Vite
// processes and bundles into the final output.
// ==========================================================================

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"

// Mount the app into the #root div defined in index.html
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
