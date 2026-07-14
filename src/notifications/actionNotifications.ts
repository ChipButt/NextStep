export type ActionNotificationPayload = {
  taskTitle?: string;
  actionText?: string;
};

export function supportsActionNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getActionNotificationPermission() {
  if (!supportsActionNotifications()) return "unsupported";
  return Notification.permission;
}

export async function requestActionNotificationPermission() {
  if (!supportsActionNotifications()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function showActionTimerNotification({ taskTitle, actionText }: ActionNotificationPayload) {
  if (!supportsActionNotifications() || Notification.permission !== "granted") return false;

  const title = "Action timer ended";
  const body = actionText
    ? `Check in: ${actionText}`
    : taskTitle
      ? `Check in on ${taskTitle}.`
      : "Check in with the next step.";
  const iconUrl = new URL(`${import.meta.env.BASE_URL}icon.svg`, window.location.href).toString();

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        tag: "next-step-action-timer",
        icon: iconUrl,
        badge: iconUrl
      });
      return true;
    } catch {
      // Fall through to the page notification API.
    }
  }

  new Notification(title, {
    body,
    tag: "next-step-action-timer",
    icon: iconUrl
  });
  return true;
}
