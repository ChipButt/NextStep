import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "./Button";
import type { Settings } from "../engine/types";
import { useSpeechRecognition } from "../voice/useSpeechRecognition";

type VoicePanelProps = {
  settings: Settings;
  prompt: string;
  onSettingsChange: (settings: Settings) => void;
  onTranscript: (text: string) => string | void;
};

export function VoicePanel({ settings, prompt, onSettingsChange, onTranscript }: VoicePanelProps) {
  const [typedCommand, setTypedCommand] = useState("");
  const [status, setStatus] = useState("Say “help me start” or “add task …”.");
  const lastSpokenPrompt = useRef("");

  const recognition = useSpeechRecognition({
    enabled: settings.voiceMode,
    continuous: settings.voiceMode,
    onFinalTranscript: (text) => {
      const response = onTranscript(text);
      setStatus(response || `Heard: ${text}`);
    }
  });

  useEffect(() => {
    if (!prompt || (!settings.voiceMode && !settings.spokenPrompts)) return;
    if (lastSpokenPrompt.current === prompt) return;
    lastSpokenPrompt.current = prompt;
    speak(prompt);
  }, [prompt, settings.spokenPrompts, settings.voiceMode]);

  function setVoiceMode(voiceMode: boolean) {
    onSettingsChange({
      ...settings,
      voiceMode,
      spokenPrompts: voiceMode ? true : settings.spokenPrompts
    });
    setStatus(voiceMode ? "Listening. Say “repeat” if you need the prompt again." : "Voice mode is off.");
  }

  function submitTypedCommand() {
    if (!typedCommand.trim()) return;
    const response = onTranscript(typedCommand);
    setStatus(response || `Command: ${typedCommand}`);
    setTypedCommand("");
  }

  return (
    <section className="voice-panel" aria-label="Voice controls">
      <div className="voice-main">
        <button
          className={settings.voiceMode ? "voice-button voice-button-active" : "voice-button"}
          type="button"
          onClick={() => setVoiceMode(!settings.voiceMode)}
          aria-pressed={settings.voiceMode}
          aria-label={settings.voiceMode ? "Turn voice mode off" : "Turn voice mode on"}
        >
          {settings.voiceMode ? <Mic size={20} aria-hidden="true" /> : <MicOff size={20} aria-hidden="true" />}
        </button>
        <div>
          <p className="voice-title">{settings.voiceMode ? "Voice mode on" : "Voice mode"}</p>
          <p className="voice-status" aria-live="polite">
            {recognition.error || recognition.interimTranscript || recognition.lastTranscript || status}
          </p>
        </div>
      </div>
      <div className="voice-actions">
        <Button variant="quiet" icon={<Volume2 size={18} />} onClick={() => speak(prompt)}>
          Repeat prompt
        </Button>
      </div>
      {!recognition.supported ? (
        <p className="voice-status">This browser does not support speech recognition. Typed voice commands still work.</p>
      ) : null}
      <form
        className="voice-typed"
        onSubmit={(event) => {
          event.preventDefault();
          submitTypedCommand();
        }}
      >
        <input
          value={typedCommand}
          onChange={(event) => setTypedCommand(event.target.value)}
          placeholder="Type a voice command"
          aria-label="Type a voice command"
        />
        <button className="icon-button solid" type="submit" aria-label="Run voice command">
          <Mic size={18} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}

export function speak(text: string) {
  if (!text || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 0.98;
  window.speechSynthesis.speak(utterance);
}
