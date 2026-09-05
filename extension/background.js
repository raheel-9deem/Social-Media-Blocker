// ==========================================================================
// Background Service Worker — handles alarms, heartbeats, and
// cross-instance messaging for the MediaBlocker extension.
//
// This is a Manifest V3 service worker. It has NO access to DOM or
// `window`. It communicates with:
//   1. Popup (React app) — via chrome.runtime.onMessage
//   2. Content scripts   — via chrome.tabs.sendMessage
//   3. Storage           — via chrome.storage.local
//
// Key responsibilities:
//   - Periodic heartbeat alarm to keep content scripts in sync
//   - Expiration alarms to auto-unblock when focus session ends (even if popup is closed)
//   - State persistence (blocked status, blocked hosts, expiration)
//   - Declarative Net Request rule management (browser-level network blocking)
//   - Notification delivery
// ==========================================================================

"use strict";

// Storage key used for all blocking state persistence.
// Must match the key used by content.js to read blocking status.
const STATE_KEY = "mediaBlockerState";

// ==========================================================================
// State Management — read/write blocking state from chrome.storage.local
// ==========================================================================

/**
 * Load the current blocking state from chrome.storage.local.
 * Returns an object with { isBlocked, blockedHosts, expiresAt, ... } or empty object.
 */
async function loadState() {
  try {
    const result = await chrome.storage.local.get(STATE_KEY);
    return result[STATE_KEY] || {};
  } catch (e) {
    console.warn("[MediaBlocker] Failed to load state:", e);
    return {};
  }
}

/**
 * Save blocking state to chrome.storage.local under the STATE_KEY.
 */
async function saveState(state) {
  try {
    await chrome.storage.local.set({ [STATE_KEY]: state });
  } catch (e) {
    console.warn("[MediaBlocker] Failed to save state:", e);
  }
}

/**
 * Notify all open browser tabs about the updated blocking status.
 */
function notifyAllTabs(isBlocked, blockedHosts) {
  chrome.tabs.query({}, function (tabs) {
    for (const tab of tabs) {
      // Skip chrome:// internal pages
      if (tab.id && tab.url && !tab.url.startsWith("chrome://")) {
        chrome.tabs.sendMessage(tab.id, {
          type: "BLOCK_UPDATE",
          isBlocked: isBlocked,
          blockedHosts: blockedHosts || [],
        }).catch(function () {
          // Content script not loaded in this tab — safe to ignore
        });
      }
    }
  });
}

// ==========================================================================
// Alarms — heartbeat and session auto-unblock
// ==========================================================================

/**
 * On install/update, create a recurring 1-minute heartbeat alarm.
 */
chrome.runtime.onInstalled.addListener(function () {
  chrome.alarms.create("heartbeat", { periodInMinutes: 1 });
  console.log("[MediaBlocker] Extension installed, heartbeat alarm created");
});

/**
 * Alarm listener:
 * 1. "focus_end": fires when a focus session's countdown expires while popup is closed.
 * 2. "heartbeat": periodic check to ping tabs and verify expiration.
 */
chrome.alarms.onAlarm.addListener(async function (alarm) {
  if (alarm.name === "focus_end") {
    console.log("[MediaBlocker] Focus session expired via alarm. Unblocking...");
    const state = await loadState();
    state.isBlocked = false;
    state.blockedHosts = [];
    state.expiresAt = null;
    await saveState(state);
    await updateBlockRules([]);
    notifyAllTabs(false, []);
    showNotification("Focus Mode Finished", "Your focus session has ended. Websites are now unblocked.");
  } else if (alarm.name === "heartbeat") {
    const state = await loadState();

    // Check if a timed block expired while background was sleeping
    if (state.isBlocked && state.expiresAt && Date.now() >= state.expiresAt) {
      console.log("[MediaBlocker] Expired session caught during heartbeat. Unblocking...");
      state.isBlocked = false;
      state.blockedHosts = [];
      state.expiresAt = null;
      await saveState(state);
      await updateBlockRules([]);
      notifyAllTabs(false, []);
      showNotification("Focus Mode Finished", "Your focus session has ended. Websites are now unblocked.");
    } else {
      // Ping tabs to keep them in sync
      chrome.tabs.query({}, function (tabs) {
        for (const tab of tabs) {
          if (tab.id && tab.url && !tab.url.startsWith("chrome://")) {
            chrome.tabs.sendMessage(tab.id, { type: "HEARTBEAT" }).catch(function () {
              // Tab may not have content script loaded — ignore
            });
          }
        }
      });
    }
  }
});

// ==========================================================================
// Message Handling — single unified listener for all message types
// ==========================================================================

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  (async function () {
    try {
      switch (msg.type) {

        // ---- State Management (used by popup for sync) ----
        case "GET_STATE": {
          const result = await chrome.storage.local.get(STATE_KEY);
          sendResponse(result[STATE_KEY] || {});
          break;
        }

        case "SET_STATE": {
          const current = await loadState();
          const updated = Object.assign({}, current, msg.payload);
          await saveState(updated);
          sendResponse({ ok: true });
          break;
        }

        // ---- URL-level blocking via declarativeNetRequest ----
        case "BLOCK_URLS": {
          await updateBlockRules(msg.urls || []);
          sendResponse({ ok: true });
          break;
        }

        // ---- Bridge: popup sends blocking decisions to content scripts ----
        case "APPLY_BLOCK": {
          const state = await loadState();
          state.isBlocked = !!msg.isBlocked;
          state.blockedHosts = msg.blockedHosts || [];
          state.expiresAt = msg.expiresAt || null;
          await saveState(state);

          // Update declarativeNetRequest rules for URL-level blocking
          await updateBlockRules(state.blockedHosts);

          // Set alarm to auto-unblock when session ends
          if (msg.isBlocked && msg.expiresAt && msg.expiresAt > Date.now()) {
            chrome.alarms.create("focus_end", { when: msg.expiresAt });
          } else {
            chrome.alarms.clear("focus_end");
          }

          // Notify all content scripts about the new blocking status
          notifyAllTabs(state.isBlocked, state.blockedHosts);

          // Show a system notification when blocking activates
          if (msg.isBlocked) {
            showNotification("Focus Mode Active", "Distracting websites are now blocked.");
          }

          sendResponse({ ok: true });
          break;
        }

        default:
          sendResponse({ error: "Unknown message type: " + msg.type });
      }
    } catch (err) {
      console.error("[MediaBlocker] Message handler error:", err);
      sendResponse({ error: err.message });
    }
  })();

  // Return true to indicate we will respond asynchronously
  return true;
});

// ==========================================================================
// Declarative Net Request — URL-level blocking via Chrome's built-in engine
// ==========================================================================

/**
 * Update the dynamic blocking rules to match the given hostname list.
 *
 * @param {string[]} hosts - Array of hostnames to block (e.g. ["youtube.com", "instagram.com"])
 */
async function updateBlockRules(hosts) {
  try {
    if (!chrome.declarativeNetRequest) return;

    // Build new rules — one per hostname
    const rules = [];
    for (let i = 0; i < hosts.length; i++) {
      rules.push({
        id: i + 1,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://" + hosts[i] + "/*",
          resourceTypes: ["main_frame", "sub_frame"],
        },
      });
    }

    // Remove all existing dynamic rules first, then add new ones
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing.map(function (r) { return r.id; });

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeRuleIds,
      addRules: rules,
    });

    console.log("[MediaBlocker] Updated DNR block rules:", hosts.length, "hosts");
  } catch (e) {
    console.warn("[MediaBlocker] DNR update failed (fallback to content script):", e);
  }
}

// ==========================================================================
// Notifications — system-level alerts via chrome.notifications API
// ==========================================================================

/**
 * Show a Chrome notification with the extension icon.
 * @param {string} title - Notification title
 * @param {string} body  - Notification body text
 */
function showNotification(title, body) {
  try {
    if (!chrome.notifications) return;
    chrome.notifications.create("mediaBlocker-" + Date.now(), {
      type: "basic",
      iconUrl: "icons/icon-128.png",
      title: title,
      message: body,
    });
  } catch (e) {
    console.warn("[MediaBlocker] Notification failed:", e);
  }
}

console.log("[MediaBlocker] Background service worker started");
