import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "../components/Button";
import { ScreenShell } from "../components/ScreenShell";
import type { EstimateMinutes, LoadLevel, PriorityLevel, Task } from "../engine/types";

type TaskInboxScreenProps = {
  tasks: Task[];
  onAddTask: (draft: TaskFormDraft) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
};

export type TaskFormDraft = {
  title: string;
  description?: string;
  importance: PriorityLevel;
  urgency: PriorityLevel;
  deadline?: string;
  estimatedMinutes: EstimateMinutes;
  energyRequired: LoadLevel;
  cognitiveLoad: LoadLevel;
  emotionalLoad: LoadLevel;
  physicalLoad: LoadLevel;
  location?: string;
  requiredItems?: string[];
};

const estimates: EstimateMinutes[] = [5, 10, 15, 30, 45, 60, 90, 120];
const loads: LoadLevel[] = ["low", "medium", "high"];
const priorities: PriorityLevel[] = [1, 2, 3];

const emptyDraft: TaskFormDraft = {
  title: "",
  importance: 2,
  urgency: 2,
  estimatedMinutes: 15,
  energyRequired: "medium",
  cognitiveLoad: "medium",
  emotionalLoad: "medium",
  physicalLoad: "medium"
};

export function TaskInboxScreen({ tasks, onAddTask, onUpdateTask, onDeleteTask }: TaskInboxScreenProps) {
  const [draft, setDraft] = useState<TaskFormDraft>(emptyDraft);
  const [showDetails, setShowDetails] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function submit() {
    if (!draft.title.trim()) return;
    onAddTask(draft);
    setDraft(emptyDraft);
    setShowDetails(false);
  }

  return (
    <ScreenShell title="Task inbox">
      <section className="panel">
        <label htmlFor="task-title">What needs doing?</label>
        <input
          id="task-title"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          placeholder="Rough is fine"
        />
        {showDetails ? <TaskDetailFields draft={draft} onChange={setDraft} /> : null}
        <div className="row-actions">
          <Button variant="quiet" onClick={() => setShowDetails((value) => !value)}>
            Add useful details
          </Button>
          <Button variant="primary" icon={<Plus size={18} />} onClick={submit} disabled={!draft.title.trim()}>
            Add task
          </Button>
        </div>
      </section>

      <div className="task-list">
        {tasks.length === 0 ? <p className="quiet-copy">No saved tasks yet.</p> : null}
        {tasks.map((task) => (
          <article className="task-row" key={task.id}>
            {editingId === task.id ? (
              <EditTaskForm
                task={task}
                onSave={(updated) => {
                  onUpdateTask(updated);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div>
                  <h2>{task.title}</h2>
                  <p>
                    {task.status} · {task.estimatedMinutes} min · energy {task.energyRequired}
                  </p>
                  {task.deadline ? <p>Due {task.deadline}</p> : null}
                </div>
                <div className="row-actions">
                  <button className="icon-button" type="button" onClick={() => setEditingId(task.id)} aria-label={`Edit ${task.title}`}>
                    <Pencil size={18} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => onUpdateTask({ ...task, status: "completed", completedAt: new Date().toISOString() })}
                    aria-label={`Complete ${task.title}`}
                  >
                    <Check size={18} aria-hidden="true" />
                  </button>
                  <button className="icon-button" type="button" onClick={() => onDeleteTask(task.id)} aria-label={`Delete ${task.title}`}>
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </ScreenShell>
  );
}

function EditTaskForm({ task, onSave, onCancel }: { task: Task; onSave: (task: Task) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<TaskFormDraft>({
    title: task.title,
    description: task.description,
    importance: task.importance,
    urgency: task.urgency,
    deadline: task.deadline,
    estimatedMinutes: task.estimatedMinutes,
    energyRequired: task.energyRequired,
    cognitiveLoad: task.cognitiveLoad,
    emotionalLoad: task.emotionalLoad,
    physicalLoad: task.physicalLoad,
    location: task.location,
    requiredItems: task.requiredItems
  });

  return (
    <div className="edit-form">
      <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      <TaskDetailFields draft={draft} onChange={setDraft} />
      <div className="row-actions">
        <Button variant="primary" onClick={() => onSave({ ...task, ...draft, updatedAt: new Date().toISOString() })}>Save</Button>
        <Button variant="quiet" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function TaskDetailFields({ draft, onChange }: { draft: TaskFormDraft; onChange: (draft: TaskFormDraft) => void }) {
  return (
    <div className="detail-grid">
      <label>
        Description
        <textarea value={draft.description ?? ""} onChange={(event) => onChange({ ...draft, description: event.target.value })} />
      </label>
      <label>
        Deadline
        <input type="date" value={draft.deadline ?? ""} onChange={(event) => onChange({ ...draft, deadline: event.target.value })} />
      </label>
      <label>
        Estimated minutes
        <select
          value={draft.estimatedMinutes}
          onChange={(event) => onChange({ ...draft, estimatedMinutes: Number(event.target.value) as EstimateMinutes })}
        >
          {estimates.map((estimate) => (
            <option key={estimate} value={estimate}>{estimate}</option>
          ))}
        </select>
      </label>
      <label>
        Importance
        <select value={draft.importance} onChange={(event) => onChange({ ...draft, importance: Number(event.target.value) as PriorityLevel })}>
          {priorities.map((priority) => (
            <option key={priority} value={priority}>{priority}</option>
          ))}
        </select>
      </label>
      <label>
        Urgency
        <select value={draft.urgency} onChange={(event) => onChange({ ...draft, urgency: Number(event.target.value) as PriorityLevel })}>
          {priorities.map((priority) => (
            <option key={priority} value={priority}>{priority}</option>
          ))}
        </select>
      </label>
      <LoadSelect label="Energy required" value={draft.energyRequired} onChange={(energyRequired) => onChange({ ...draft, energyRequired })} />
      <LoadSelect label="Cognitive load" value={draft.cognitiveLoad} onChange={(cognitiveLoad) => onChange({ ...draft, cognitiveLoad })} />
      <LoadSelect label="Emotional load" value={draft.emotionalLoad} onChange={(emotionalLoad) => onChange({ ...draft, emotionalLoad })} />
      <LoadSelect label="Physical load" value={draft.physicalLoad} onChange={(physicalLoad) => onChange({ ...draft, physicalLoad })} />
      <label>
        Location
        <input value={draft.location ?? ""} onChange={(event) => onChange({ ...draft, location: event.target.value })} />
      </label>
      <label>
        Required items
        <input
          value={draft.requiredItems?.join(", ") ?? ""}
          onChange={(event) =>
            onChange({ ...draft, requiredItems: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })
          }
          placeholder="Comma separated"
        />
      </label>
    </div>
  );
}

function LoadSelect({ label, value, onChange }: { label: string; value: LoadLevel; onChange: (value: LoadLevel) => void }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as LoadLevel)}>
        {loads.map((load) => (
          <option key={load} value={load}>{load}</option>
        ))}
      </select>
    </label>
  );
}
