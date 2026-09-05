// ==========================================================================
// Background Service Worker — handles alarms, heartbeats, and
// cross-instance messaging for the MediaBlocker extension.
// ==========================================================================

var STATE_KEY = "mediaBlockerState"

function loadState() {
  try {
    var raw = chrome.storage.local.get(STATE_KEY)
    return new Promise(function (resolve) {
      chrome.storage.local.get(STATE_KEY, function (result) {
        resolve(result[STATE_KEY] || {})
      })
    })
  } catch (e) {
    return Promise.resolve({})
  }
}

function saveState(state) {
  return new Promise(function (resolve) {
    chrome.storage.local.set(Object.assign({}, state))
    resolve()
  })
}

// ---- Alarms ----

chrome.runtime.onInstalled.addListener(function () {
  chrome.alarms.create("heartbeat", { periodInMinutes: 1 })
})

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === "heartbeat") {
    chrome.tabs.query({}, function (tabs) {
      for (var i = 0; i < tabs.length; i++) {
        var tab = tabs[i]
        if (tab.id && tab.url && tab.url.indexOf("chrome://") !== 0) {
          chrome.tabs.sendMessage(tab.id, { type: "HEARTBEAT" })
        }
      }
    })
  }
})

// ---- Messages ----

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  ;(async function () {
    try {
      switch (msg.type) {
        case "GET_STATE": {
          var result = await chrome.storage.local.get(STATE_KEY)
          sendResponse(result[STATE_KEY] || {})
          break
        }
        case "SET_STATE": {
          var current = (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || {}
          saveState(Object.assign({}, current, msg.payload))
          sendResponse({ ok: true })
          break
        }
        case "BLOCK_URLS": {
          await updateBlockRules(msg.urls || [])
          sendResponse({ ok: true })
          break
        }
        default:
          sendResponse({ error: "Unknown message type" })
      }
    } catch (err) {
      sendResponse({ error: err.message })
    }
  })()

  return true
})

// ---- Declarative Net Request (block list) ----

async function updateBlockRules(urls) {
  try {
    var rules = []
    for (var i = 0; i < urls.length; i++) {
      rules.push({
        id: i + 1,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://" + urls[i] + "/*",
          resourceTypes: [1]
        }
      })
    }

    var existing = await chrome.declarativeNetRequest.getDynamicRules()
    var removeRuleIds = existing.map(function (r) { return r.id })
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeRuleIds,
      addRules: rules
    })
  } catch (e) {
    // DNR API may not be available; fallback handled by content script
  }
}

// ---- Notifications ----

function showNotification(title, body) {
  chrome.notifications.create("mediaBlocker-" + Date.now(), {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: title,
    message: body
  })
}

// ---- Listen for block changes from popup ----

chrome.runtime.onMessage.addListener(function (msg) {
  if (msg.type === "APPLY_BLOCK") {
    ;(async function () {
      var state = await loadState()
      state.isBlocked = msg.isBlocked
      state.blockedHosts = msg.blockedHosts || []
      await saveState(state)
      await updateBlockRules(state.blockedHosts)

      chrome.tabs.query({}, function (tabs) {
        for (var i = 0; i < tabs.length; i++) {
          if (tabs[i].id && tabs[i].url && tabs[i].url.indexOf("chrome://") !== 0) {
            chrome.tabs.sendMessage(tabs[i].id, {
              type: "BLOCK_UPDATE",
              isBlocked: msg.isBlocked
            }).catch(function () {})
          }
        }
      })

      if (msg.isBlocked) {
        showNotification("Focus Mode Active", "Social media is now blocked.")
      }
    })()
  }
})

console.log("[MediaBlocker] Background service worker started")
