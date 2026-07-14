import type { EstimateMinutes, LoadLevel, PriorityLevel, Task, TaskStep } from "./types";

const estimates: EstimateMinutes[] = [5, 10, 15, 30, 45, 60, 90, 120];

export function createId(prefix = "id", now = new Date()) {
  return `${prefix}-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function asEstimate(value: number): EstimateMinutes {
  return estimates.includes(value as EstimateMinutes) ? (value as EstimateMinutes) : 15;
}

export function createTaskStep(text: string, order: number, now = new Date()): TaskStep {
  return {
    id: createId(`step-${order}`, now),
    text: normaliseStepText(text),
    completed: false,
    order
  };
}

export function normaliseStepText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "Write down the first visible action.";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export type TaskDraft = {
  title: string;
  description?: string;
  importance?: PriorityLevel;
  urgency?: PriorityLevel;
  deadline?: string;
  estimatedMinutes?: EstimateMinutes;
  energyRequired?: LoadLevel;
  cognitiveLoad?: LoadLevel;
  emotionalLoad?: LoadLevel;
  physicalLoad?: LoadLevel;
  location?: string;
  requiredItems?: string[];
  blockedBy?: string;
  parentTaskId?: string;
  steps?: string[];
  status?: Task["status"];
};

export function createTask(draft: TaskDraft, now = new Date()): Task {
  const timestamp = now.toISOString();
  return {
    id: createId("task", now),
    title: draft.title.trim() || "Untitled task",
    description: draft.description?.trim() || undefined,
    status: draft.status ?? "inbox",
    importance: draft.importance ?? 2,
    urgency: draft.urgency ?? 2,
    deadline: draft.deadline || undefined,
    estimatedMinutes: draft.estimatedMinutes ?? 15,
    energyRequired: draft.energyRequired ?? "medium",
    cognitiveLoad: draft.cognitiveLoad ?? "medium",
    emotionalLoad: draft.emotionalLoad ?? "medium",
    physicalLoad: draft.physicalLoad ?? "medium",
    location: draft.location?.trim() || undefined,
    requiredItems: draft.requiredItems?.map((item) => item.trim()).filter(Boolean),
    blockedBy: draft.blockedBy,
    parentTaskId: draft.parentTaskId,
    steps: (draft.steps ?? []).map((step, index) => createTaskStep(step, index + 1, now)),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function touchTask(task: Task, patch: Partial<Task>, now = new Date()): Task {
  return {
    ...task,
    ...patch,
    updatedAt: now.toISOString()
  };
}
