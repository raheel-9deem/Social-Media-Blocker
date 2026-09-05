// ==========================================================================
// Content Script — injected into every page to enforce blocking rules.
// Communicates with the popup via chrome.storage and the background SW.
// ==========================================================================

(function () {
  "use strict"

  var blocked = false

  // Listen for messages from background / popup
  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.type === "HEARTBEAT" || msg.type === "BLOCK_UPDATE") {
      checkBlocking()
    }
  })

  // Watch storage for block changes
  chrome.storage.onChanged.addListener(function (changes) {
    if (changes.isBlocked) {
      checkBlocking()
    }
  })

  // Initial check
  checkBlocking()

  // ---- Blocking helpers ----

  async function checkBlocking() {
    try {
      var data = await chrome.storage.local.get(["isBlocked"])
      var shouldBlock = !!data.isBlocked

      if (shouldBlock && !blocked) {
        applyBlock()
      } else if (!shouldBlock && blocked) {
        removeBlock()
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  function applyBlock() {
    blocked = true

    var overlay = document.createElement("div")
    overlay.id = "mediaBlockerOverlay"
    overlay.style.cssText = [
      "position: fixed !important",
      "inset: 0 !important",
      "z-index: 2147483647 !important",
      "background: #ffffff !important",
      "display: flex !important",
      "flex-direction: column !important",
      "align-items: center !important",
      "justify-content: center !important",
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important",
      "color: #334155 !important",
      "text-align: center !important",
      "padding: 2rem !important",
    ].join(";")

    overlay.innerHTML = [
      "<div style='font-size: 48px; margin-bottom: 16px;'>🛡️</div>",
      "<h1 style='font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #1e293b;'>",
      "This site is blocked",
      "</h1>",
      "<p style='font-size: 14px; color: #64748b; max-width: 320px; line-height: 1.5;'>",
      "Focus Mode is active. Open the MediaBlocker popup to disable it.",
      "</p>",
    ].join("")

    document.documentElement.appendChild(overlay)

    // Prevent DevTools shortcut
    document.addEventListener("keydown", preventNav, true)
  }

  function removeBlock() {
    blocked = false
    var overlay = document.getElementById("mediaBlockerOverlay")
    if (overlay) {
      overlay.remove()
    }
    document.removeEventListener("keydown", preventNav, true)
  }

  function preventNav(e) {
    var blockedKeys = ["F5", "F12"]
    var combo = ""
    if (e.ctrlKey || e.metaKey) combo += "Ctrl+"
    if (e.shiftKey) combo += "Shift+"

    if (blockedKeys.indexOf(e.key) !== -1 || combo + e.key === "Ctrl+R" || combo + e.key === "Ctrl+Shift+R") {
      e.preventDefault()
      e.stopPropagation()
    }
  }
})()
