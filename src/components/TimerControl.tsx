import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "./Button";

type TimerControlProps = {
  minutes: number;
  label?: string;
  sound?: boolean;
};

export function TimerControl({ minutes, label = "Start timer", sound = false }: TimerControlProps) {
  const total = minutes * 60;
  const [remaining, setRemaining] = useState(total);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRemaining(total);
    setRunning(false);
  }, [total]);

  useEffect(() => {
    if (!running || remaining <= 0) return undefined;
    const id = window.setInterval(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearInterval(id);
  }, [running, remaining]);

  useEffect(() => {
    if (remaining === 0 && sound) playSoftTone();
  }, [remaining, sound]);

  const minutesLeft = Math.floor(remaining / 60);
  const secondsLeft = String(remaining % 60).padStart(2, "0");

  return (
    <div className="timer-control" aria-live="polite">
      <Button
        variant="quiet"
        icon={running ? <Pause size={18} /> : <Play size={18} />}
        onClick={() => setRunning((value) => !value)}
      >
        {running ? `${minutesLeft}:${secondsLeft}` : label}
      </Button>
      {remaining !== total ? (
        <button className="icon-button" type="button" onClick={() => setRemaining(total)} aria-label="Reset timer">
          <RotateCcw size={18} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function playSoftTone() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 528;
  gain.gain.value = 0.035;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.18);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
