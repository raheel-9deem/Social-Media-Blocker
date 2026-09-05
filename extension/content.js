// ==========================================================================
// Content Script — injected into every page to enforce blocking rules.
// Communicates with the popup via chrome.storage and the background SW.
// ==========================================================================

;(function () {
  "use strict"

  let blocked = false

  // ---- Listen for messages from popup / background ----

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "HEARTBEAT") {
      checkBlocking()
    }
  })

  // ---- Watch storage for block changes ----

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.blockedPlatforms || changes.isFocusMode) {
      checkBlocking()
    }
  })

  // ---- Initial check ----

  checkBlocking()

  // ---- Blocking logic ----

  async function checkBlocking() {
    const data = await chrome.storage.local.get(["blockedHosts", "isBlocked"])
    const shouldBlock = !!data.isBlocked

    if (shouldBlock && !blocked) {
      applyBlock()
    } else if (!shouldBlock && blocked) {
      removeBlock()
    }
  }

  function applyBlock() {
    blocked = true

    // Overlay
    const overlay = document.createElement("div")
    overlay.id = "mediaBlockerOverlay"
    overlay.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background: #ffffff !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      color: #334155 !important;
      text-align: center !important;
      padding: 2rem !important;
    `
    overlay.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">🛡️</div>
      <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #1e293b;">
        This site is blocked
      </h1>
      <p style="font-size: 14px; color: #64748b; max-width: 320px; line-height: 1.5;">
        You activated Focus Mode or a scheduled block. Use the MediaBlocker popup to disable it.
      </p>
    `
    document.documentElement.appendChild(overlay)

    // Prevent navigation away from overlay
    document.addEventListener("keydown", preventNav, true)
  }

  function removeBlock() {
    blocked = false
    const overlay = document.getElementById("mediaBlockerOverlay")
    if (overlay) overlay.remove()
    document.removeEventListener("keydown", preventNav, true)
  }

  function preventNav(e: KeyboardEvent) {
    if (["F5", "F12", "Ctrl+R", "Cmd+R", "Ctrl+Shift+R", "Cmd+Shift+R"].includes(
      e.key || `${e.ctrlKey || e.metaKey ? (e.ctrlKey ? "Ctrl" : "Cmd") : ""}${e.shiftKey ? "+Shift" : ""}+${e.key}`
    )) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
})()
