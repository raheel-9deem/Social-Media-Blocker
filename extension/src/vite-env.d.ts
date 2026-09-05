/// <reference types="vite/client" />

interface ChromeApis {
  runtime: {
    sendMessage: (message: any, callback?: (response: any) => void) => Promise<any>
    onMessage: {
      addListener: (callback: (msg: any, sender: any, sendResponse: any) => void) => void
    }
  }
  storage: {
    local: {
      get: (keys: string | string[]) => Promise<any>
      set: (items: Record<string, any>) => Promise<void>
      onChanged: {
        addListener: (callback: (changes: any, area: string) => void) => void
      }
    }
    onChanged: {
      addListener: (callback: (changes: any, area: string) => void) => void
    }
  }
  tabs: {
    query: (queryInfo?: any) => Promise<any[]>
    sendMessage: (tabId: number, message: any) => Promise<any>
  }
  alarms: any
  notifications: any
  declarativeNetRequest: any
}

declare const chrome: ChromeApis
