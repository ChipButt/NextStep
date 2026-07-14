import { useEffect, useRef } from "react";
import type { Session, Settings } from "../engine/types";
import { showActionTimerNotification } from "./actionNotifications";
import { playSoftTone } from "./timerEffects";

type ActionTimerWatcherOptions = {
  session?: Session;
  settings: Settings;
  taskTitle?: string;
  onExpired: (expiredAt: string) => void;
  onNotificationSent: (sentAt: string) => void;
};

export function useActionTimerWatcher({
  session,
  settings,
  taskTitle,
  onExpired,
  onNotificationSent
}: ActionTimerWatcherOptions) {
  const expiryRequestedRef = useRef<string>();
  const notificationRequestedRef = useRef<string>();

  useEffect(() => {
    if (!session?.actionTimerEndsAt || session.actionTimerExpiredAt) return;
    const endTime = new Date(session.actionTimerEndsAt).getTime();
    if (Number.isNaN(endTime)) return;

    const timerKey = `${session.id}:${session.actionTimerEndsAt}`;
    const expireIfDue = () => {
      if (Date.now() < endTime || expiryRequestedRef.current === timerKey) return;
      expiryRequestedRef.current = timerKey;
      onExpired(new Date().toISOString());
      if (settings.sound) playSoftTone();
    };

    expireIfDue();
    const timeoutId = window.setTimeout(expireIfDue, Math.max(0, endTime - Date.now()));
    const intervalId = window.setInterval(expireIfDue, 1000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [onExpired, session?.actionTimerEndsAt, session?.actionTimerExpiredAt, session?.id, settings.sound]);

  useEffect(() => {
    if (
      !session?.actionTimerEndsAt ||
      !session.actionTimerExpiredAt ||
      session.actionTimerNotificationSentAt ||
      !settings.actionNotifications
    ) {
      return;
    }

    const timerKey = `${session.id}:${session.actionTimerEndsAt}`;
    if (notificationRequestedRef.current === timerKey) return;
    notificationRequestedRef.current = timerKey;

    showActionTimerNotification({ taskTitle, actionText: session.currentAction }).then((sent) => {
      if (sent) onNotificationSent(new Date().toISOString());
    });
  }, [
    onNotificationSent,
    session?.actionTimerEndsAt,
    session?.actionTimerExpiredAt,
    session?.actionTimerNotificationSentAt,
    session?.currentAction,
    session?.id,
    settings.actionNotifications,
    taskTitle
  ]);
}
