import { useState } from "react";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Button } from "../components/Button";
import { ScreenShell } from "../components/ScreenShell";
import type { Settings, Task } from "../engine/types";

type StartScreenProps = {
  tasks: Task[];
  settings: Settings;
  onAddTask: (title: string) => void;
  onStart: () => void;
  onDemoSeen: () => void;
  onResumeTask: (taskId: string) => void;
};

const demoSteps = [
  "Stand up.",
  "Pick up the laundry basket.",
  "Carry it to the washing machine.",
  "Put the clothes into the machine.",
  "Add detergent.",
  "Choose the usual wash setting.",
  "Press start."
];

export function StartScreen({ tasks, settings, onAddTask, onStart, onDemoSeen, onResumeTask }: StartScreenProps) {
  const [title, setTitle] = useState("");
  const pausedTasks = tasks.filter((task) => task.status === "paused");
  const activeTasks = tasks.filter((task) => task.status !== "completed" && task.status !== "abandoned");

  function submitTask() {
    if (!title.trim()) return;
    onAddTask(title);
    setTitle("");
  }

  return (
    <ScreenShell title="Next Step">
      {!settings.firstLaunchDemoSeen ? (
        <section className="panel demo-panel" aria-labelledby="demo-title">
          <h2 id="demo-title">Put a load of washing on</h2>
          <p>Next Step turns that into:</p>
          <ol>
            {demoSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>You will normally see only one of these steps at a time.</p>
          <Button variant="primary" icon={<Check size={19} />} onClick={onDemoSeen}>
            Got it
          </Button>
        </section>
      ) : null}

      {pausedTasks.length ? (
        <section className="panel">
          <p className="eyebrow">You stopped here</p>
          <h2>{pausedTasks[0].title}</h2>
          <Button variant="primary" onClick={() => onResumeTask(pausedTasks[0].id)}>
            Resume this task
          </Button>
        </section>
      ) : null}

      <section className="panel capture-panel">
        <label htmlFor="quick-task">{activeTasks.length ? "Add a task" : "What is taking up space in your head?"}</label>
        <div className="inline-form">
          <input
            id="quick-task"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitTask();
            }}
            placeholder="Write it roughly"
          />
          <button className="icon-button solid" type="button" onClick={submitTask} aria-label="Add another">
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
        {activeTasks.length ? <p className="quiet-copy">That is enough to begin.</p> : null}
      </section>

      <div className="primary-action-stack">
        <Button variant="primary" icon={<ArrowRight size={20} />} disabled={!activeTasks.length} onClick={onStart}>
          Help me start
        </Button>
        {activeTasks.length ? (
          <Button variant="quiet" icon={<Plus size={18} />} onClick={() => document.getElementById("quick-task")?.focus()}>
            Add another task
          </Button>
        ) : null}
      </div>
    </ScreenShell>
  );
}
