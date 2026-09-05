// ==========================================================================
// Background Service Worker — handles alarms, heartbeats, and
// cross-instance messaging for the MediaBlocker extension.
// ==========================================================================

// ---- State ----

const STATE_KEY = "mediaBlockerState"

function loadState() {
  try {
    return JSON.parse(chrome.storage.local.get(STATE_KEY))[STATE_KEY] || {}
  } catch {
    return {}
  }
}

function saveState(state: Record<string, any>) {
  chrome.storage.local.set({ [STATE_KEY]: state })
}

// ---- Alarms ----

chrome.runtime.onInstalled.addListener(() => {
  // Evaluate blocking once on install
  chrome.alarms.create("heartbeat", { periodInMinutes: 1 })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "heartbeat") {
    // Heartbeat triggers content scripts to re-check blocking state
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith("chrome://")) {
          chrome.tabs.sendMessage(tab.id, { type: "HEARTBEAT" }).catch(() => {})
        }
      }
    })
  }
})

// ---- Messages ----

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ;(async () => {
    switch (msg.type) {
      case "GET_STATE": {
        const state = await chrome.storage.local.get(STATE_KEY)
        sendResponse(state[STATE_KEY] || {})
        break
      }
      case "SET_STATE": {
        const current = (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || {}
        saveState({ ...current, ...msg.payload })
        sendResponse({ ok: true })
        break
      }
      case "BLOCK_URLS": {
        // Update declarative net request rules (Manifest V3)
        await updateBlockRules(msg.urls || [])
        sendResponse({ ok: true })
        break
      }
      default:
        sendResponse({ error: "Unknown message type" })
    }
  })().catch((e) => sendResponse({ error: e.message }))

  return true // keep message channel open for async response
})

// ---- Declarative Net Request (block list) ----

const RULE_RESOURCE_TYPE = 1 // MAIN_FRAME

async function updateBlockRules(urls: string[]) {
  try {
    const rules = urls.map((host, i) => ({
      id: i + 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: `*://${host}/*`,
        resourceTypes: [RULE_RESOURCE_TYPE],
      },
    }))

    // Remove existing dynamic rules, add new ones
    const existing = await chrome.declarativeNetRequest.getDynamicRules()
    const removeRuleIds = existing.map((r) => r.id)
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: rules,
    })
  } catch {
    // declarativeNetRequest API may not be available in all contexts
  }
}

// ---- Notifications ----

function showNotification(title: string, body: string) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title,
    message: body,
  })
}

console.log("[MediaBlocker] Background service worker started")
