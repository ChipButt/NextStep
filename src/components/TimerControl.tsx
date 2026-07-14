import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";

type TimerControlProps = {
  seconds: number;
  startedAt?: string;
  endsAt?: string;
  onStarted: (startedAt: string, endsAt: string) => void;
};

export function TimerControl({
  seconds,
  startedAt,
  endsAt,
  onStarted
}: TimerControlProps) {
  const [remaining, setRemaining] = useState(() => getRemainingSeconds(endsAt, seconds));
  const startRequestedRef = useRef(false);

  useEffect(() => {
    if (endsAt || startRequestedRef.current) return;
    startRequestedRef.current = true;
    const started = new Date();
    const ends = new Date(started.getTime() + seconds * 1000);
    onStarted(started.toISOString(), ends.toISOString());
  }, [endsAt, onStarted, seconds]);

  useEffect(() => {
    setRemaining(getRemainingSeconds(endsAt, seconds));
    const id = window.setInterval(() => {
      setRemaining(getRemainingSeconds(endsAt, seconds));
    }, 1000);
    return () => window.clearInterval(id);
  }, [endsAt, seconds]);

  const hasEnded = remaining <= 0;

  return (
    <div className={hasEnded ? "timer-control timer-control-ended" : "timer-control"} aria-live="polite">
      <div className="timer-readout">
        <Clock3 size={18} aria-hidden="true" />
        <span>{hasEnded ? "Timer ended" : formatSeconds(remaining)}</span>
      </div>
      <p className="timer-subtext">
        Started automatically{startedAt ? ` at ${formatClock(startedAt)}` : ""}. Refreshing keeps this end time.
      </p>
    </div>
  );
}

function getRemainingSeconds(endsAt: string | undefined, fallbackSeconds: number) {
  if (!endsAt) return fallbackSeconds;
  const endTime = new Date(endsAt).getTime();
  if (Number.isNaN(endTime)) return fallbackSeconds;
  return Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
}

function formatSeconds(seconds: number) {
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}

function formatClock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
