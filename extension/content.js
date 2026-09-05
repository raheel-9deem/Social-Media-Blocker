// ==========================================================================
// Content Script — injected into every page to enforce blocking rules.
//
// This script runs at document_start in all frames. It:
//   1. Checks chrome.storage.local for current blocking state
//   2. Compares the current page's hostname against blocked hosts
//   3. If blocked, overlays a full-page "blocked" screen
//   4. Listens for real-time updates from the background service worker
//
// Communication channels:
//   - chrome.storage.local → read blocking state
//   - chrome.storage.onChanged → react to state changes
//   - chrome.runtime.onMessage → receive HEARTBEAT and BLOCK_UPDATE messages
//
// The storage key must match background.js: "mediaBlockerState"
// ==========================================================================

;(function () {
  "use strict";

  // ---- Constants ----

  /** Storage key — must match background.js STATE_KEY */
  var STATE_KEY = "mediaBlockerState";

  /** Whether a blocking overlay is currently displayed */
  var overlayActive = false;

  // ---- Message Listener ----

  /**
   * Listen for messages from the background service worker.
   * - HEARTBEAT: periodic ping to re-check blocking status
   * - BLOCK_UPDATE: immediate notification that blocking state changed
   */
  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.type === "HEARTBEAT" || msg.type === "BLOCK_UPDATE") {
      checkBlocking();
    }
  });

  // ---- Storage Change Listener ----

  /**
   * Watch for changes to the blocking state key in chrome.storage.
   * This fires when the popup or background updates the state.
   *
   * BUG FIX: Previously checked `changes.isBlocked` which doesn't exist
   * as a top-level storage key. The state is stored under "mediaBlockerState".
   */
  chrome.storage.onChanged.addListener(function (changes) {
    if (changes[STATE_KEY]) {
      checkBlocking();
    }
  });

  // ---- Initial Check ----

  // Run immediately on injection to block before page renders
  checkBlocking();

  // ==========================================================================
  // Blocking Logic
  // ==========================================================================

  /**
   * Main blocking check: reads state from storage, determines if the
   * current page's hostname matches any blocked host, and shows/hides
   * the blocking overlay accordingly.
   *
   * BUG FIX: Previously read `chrome.storage.local.get(["isBlocked"])`
   * which returns undefined because state is stored under STATE_KEY.
   * Now correctly reads from the STATE_KEY wrapper.
   *
   * BUG FIX: Previously blocked ALL pages when isBlocked=true. Now only
   * blocks pages whose hostname matches a blocked host.
   */
  async function checkBlocking() {
    try {
      var result = await chrome.storage.local.get([STATE_KEY]);
      var state = result[STATE_KEY] || {};
      var isBlocked = !!state.isBlocked;
      var blockedHosts = state.blockedHosts || [];

      // Determine if the current page's hostname matches any blocked host
      var currentHost = window.location.hostname.toLowerCase();
      var shouldBlock = false;

      if (isBlocked && blockedHosts.length > 0) {
        for (var i = 0; i < blockedHosts.length; i++) {
          var blocked = blockedHosts[i].toLowerCase();
          // Match exact hostname or subdomain (e.g. "www.youtube.com" matches "youtube.com")
          if (currentHost === blocked || currentHost.endsWith("." + blocked)) {
            shouldBlock = true;
            break;
          }
        }
      }

      // Apply or remove the blocking overlay
      if (shouldBlock && !overlayActive) {
        applyBlock();
      } else if (!shouldBlock && overlayActive) {
        removeBlock();
      }
    } catch (e) {
      // Storage may not be available (e.g. in restricted pages)
      // Fail silently to avoid console spam
    }
  }

  // ==========================================================================
  // Overlay Management
  // ==========================================================================

  /**
   * Create and inject a full-page blocking overlay.
   * Uses maximum z-index and !important on all styles to ensure it
   * cannot be hidden by page CSS or DevTools manipulation.
   */
  function applyBlock() {
    overlayActive = true;

    var overlay = document.createElement("div");
    overlay.id = "mediaBlockerOverlay";
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
    ].join(";");

    overlay.innerHTML = [
      "<div style='font-size: 48px; margin-bottom: 16px;'>🛡️</div>",
      "<h1 style='font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #1e293b;'>",
      "This site is blocked",
      "</h1>",
      "<p style='font-size: 14px; color: #64748b; max-width: 320px; line-height: 1.5;'>",
      "Focus Mode is active. Open the MediaBlocker popup to disable it.",
      "</p>",
    ].join("");

    // Inject into documentElement (available even at document_start)
    if (document.documentElement) {
      document.documentElement.appendChild(overlay);
    }

    // Prevent navigation shortcuts that could bypass the block
    document.addEventListener("keydown", preventNav, true);
  }

  /**
   * Remove the blocking overlay and restore normal page access.
   */
  function removeBlock() {
    overlayActive = false;
    var overlay = document.getElementById("mediaBlockerOverlay");
    if (overlay) {
      overlay.remove();
    }
    document.removeEventListener("keydown", preventNav, true);
  }

  // ==========================================================================
  // Navigation Prevention
  // ==========================================================================

  /**
   * Prevent keyboard shortcuts that could bypass the blocking overlay.
   * Blocks: F5 (refresh), F12 (DevTools), Ctrl+R, Ctrl+Shift+R
   *
   * Note: This is a soft prevention. Determined users can still use
   * the address bar or DevTools. The declarativeNetRequest rules in
   * background.js provide the hard block at the network level.
   */
  function preventNav(e) {
    var blockedKeys = ["F5", "F12"];
    var combo = "";
    if (e.ctrlKey || e.metaKey) combo += "Ctrl+";
    if (e.shiftKey) combo += "Shift+";

    if (
      blockedKeys.indexOf(e.key) !== -1 ||
      combo + e.key === "Ctrl+R" ||
      combo + e.key === "Ctrl+Shift+R"
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
})();
