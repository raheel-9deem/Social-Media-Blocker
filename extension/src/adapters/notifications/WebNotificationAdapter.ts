// ==========================================================================
// WebNotificationAdapter — in-app toast notifications via Sonner
// + optional browser Notification API.
// ==========================================================================

import { toast } from "sonner"

export type NotificationType = "success" | "error" | "warning" | "info"

export interface NotificationPayload {
  title: string
  message?: string
  type?: NotificationType
  duration?: number
}

/**
 * WebNotificationAdapter sends notifications via Sonner (in-app).
 * Optionally uses the browser Notification API for system-level alerts
 * when permission is granted.
 */
export class WebNotificationAdapter {
  private permission = "Notification" in window ? Notification.permission : "denied"

  /**
   * Send an in-app toast notification.
   */
  notify(payload: NotificationPayload): void {
    const { title, message, type = "info", duration = 4000 } = payload

    switch (type) {
      case "success":
        toast.success(title, { description: message, duration })
        break
      case "error":
        toast.error(title, { description: message, duration })
        break
      case "warning":
        toast.warning(title, { description: message, duration })
        break
      default:
        toast(title, { description: message, duration })
    }
  }

  /**
   * Try to send a browser-level notification (requires permission).
   * Falls back to in-app toast if not permitted.
   */
  async notifySystem(payload: NotificationPayload): Promise<void> {
    if ("Notification" in window) {
      if (this.permission === "granted") {
        new Notification(payload.title, {
          body: payload.message ?? "",
          icon: "/favicon.svg",
        })
        return
      }
      // Request permission
      if (this.permission !== "denied") {
        const perm = await Notification.requestPermission()
        this.permission = perm
        if (perm === "granted") {
          new Notification(payload.title, {
            body: payload.message ?? "",
            icon: "/favicon.svg",
          })
          return
        }
      }
    }
    // Fallback to in-app
    this.notify(payload)
  }

  /** Convenience: notify "limit exceeded" */
  notifyLimitExceeded(platformName: string): void {
    this.notify({
      type: "warning",
      title: `${platformName} limit reached`,
      message: "Your daily time budget has been exceeded.",
    })
  }

  /** Convenience: notify "daily reset" */
  notifyDailyReset(): void {
    this.notify({
      type: "success",
      title: "New day, fresh start!",
      message: "Your usage limits have been reset.",
    })
  }

  /** Convenience: notify Focus Mode started */
  notifyFocusStart(durationMinutes: number): void {
    this.notify({
      type: "info",
      title: "Focus Mode activated",
      message: `${durationMinutes} minutes of distraction-free time.`,
    })
  }

  /** Convenience: notify Focus Mode ended */
  notifyFocusEnd(): void {
    this.notify({
      type: "info",
      title: "Focus session complete",
      message: "You're free to use social media again.",
    })
  }
}

export const notificationAdapter = new WebNotificationAdapter()
