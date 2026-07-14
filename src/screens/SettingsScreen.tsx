import { useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { Button } from "../components/Button";
import { ScreenShell } from "../components/ScreenShell";
import type { AppData, Settings } from "../engine/types";
import { exportAppData, importAppData } from "../storage/localStore";

type SettingsScreenProps = {
  data: AppData;
  onSettingsChange: (settings: Settings) => void;
  onReset: () => void;
  onImport: (data: AppData) => void;
  onLoadSamples: () => void;
};

export function SettingsScreen({ data, onSettingsChange, onReset, onImport, onLoadSamples }: SettingsScreenProps) {
  const [importText, setImportText] = useState("");

  function update(patch: Partial<Settings>) {
    onSettingsChange({ ...data.settings, ...patch });
  }

  function downloadExport() {
    const blob = new Blob([exportAppData(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "next-step-data.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ScreenShell title="Settings">
      <section className="panel settings-panel">
        <label>
          Text size
          <select value={data.settings.textSize} onChange={(event) => update({ textSize: event.target.value as Settings["textSize"] })}>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
            <option value="extraLarge">Extra large</option>
          </select>
        </label>
        <label>
          Default timer
          <select
            value={data.settings.defaultTimerMinutes}
            onChange={(event) => update({ defaultTimerMinutes: Number(event.target.value) as Settings["defaultTimerMinutes"] })}
          >
            <option value={3}>3 minutes</option>
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
          </select>
        </label>
        <Toggle label="High contrast" checked={data.settings.highContrast} onChange={(highContrast) => update({ highContrast })} />
        <Toggle label="Reduced motion" checked={data.settings.reducedMotion} onChange={(reducedMotion) => update({ reducedMotion })} />
        <Toggle label="Sound" checked={data.settings.sound} onChange={(sound) => update({ sound })} />
        <Toggle label="Voice mode" checked={data.settings.voiceMode} onChange={(voiceMode) => update({ voiceMode, spokenPrompts: voiceMode ? true : data.settings.spokenPrompts })} />
        <Toggle label="Spoken prompts" checked={data.settings.spokenPrompts} onChange={(spokenPrompts) => update({ spokenPrompts })} />
        <Toggle
          label="Brief acknowledgements"
          checked={data.settings.showAcknowledgements}
          onChange={(showAcknowledgements) => update({ showAcknowledgements })}
        />
        <Toggle label="Debug" checked={data.settings.debugMode} onChange={(debugMode) => update({ debugMode })} />
      </section>

      <section className="panel settings-panel">
        <Button variant="secondary" onClick={onLoadSamples}>Load sample tasks</Button>
        <Button variant="secondary" icon={<Download size={18} />} onClick={downloadExport}>Export data as JSON</Button>
        <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Paste imported JSON" />
        <Button
          variant="secondary"
          icon={<Upload size={18} />}
          disabled={!importText.trim()}
          onClick={() => onImport(importAppData(importText))}
        >
          Import data
        </Button>
        <Button
          variant="quiet"
          icon={<RotateCcw size={18} />}
          onClick={() => {
            if (window.confirm("Reset all local data?")) onReset();
          }}
        >
          Reset all local data
        </Button>
      </section>
    </ScreenShell>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
