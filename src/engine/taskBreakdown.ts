import { createTaskStep, normaliseStepText } from "./taskFactory";
import type { BlockerId, Task, TaskCategory, TaskStep } from "./types";

const actionVerbs = [
  "add",
  "ask",
  "carry",
  "charge",
  "choose",
  "close",
  "collect",
  "complete",
  "count",
  "create",
  "decide",
  "fill",
  "find",
  "leave",
  "locate",
  "make",
  "move",
  "open",
  "pick",
  "place",
  "press",
  "put",
  "record",
  "review",
  "save",
  "send",
  "stand",
  "start",
  "turn",
  "walk",
  "write"
];

const vagueActions = [
  "sort the kitchen",
  "work on the application",
  "deal with emails",
  "get organised",
  "finish the report",
  "plan the project",
  "be productive"
];

export type ActionValidation = {
  valid: boolean;
  reason?: "missing-verb" | "vague" | "multiple-actions" | "empty";
  split?: string[];
};

export function inferTaskCategory(task: Pick<Task, "title" | "description">): TaskCategory {
  const text = `${task.title} ${task.description ?? ""}`.toLowerCase();
  if (/\b(email|message|reply|dm|text)\b/.test(text)) return "communication";
  if (/\b(call|phone|ring)\b/.test(text)) return "phone";
  if (/\b(clean|wash|washing|laundry|dishes|kitchen|bin|bins|trash|tidy)\b/.test(text)) {
    return "cleaning";
  }
  if (/\b(application|form|admin|receipt|receipts|book|appointment|document|website|bill|tax)\b/.test(text)) {
    return "administrative";
  }
  if (/\b(edit|video|write|draft|paint|draw|music|creative)\b/.test(text)) return "creative";
  if (/\b(research|learn|compare|look up|find out)\b/.test(text)) return "research";
  if (/\b(leave|outside|go to|travel|door)\b/.test(text)) return "leaving";
  return "generic";
}

export function ensureTaskSteps(task: Task, now = new Date()): Task {
  if (task.steps.length > 0) {
    return {
      ...task,
      steps: [...task.steps].sort((a, b) => a.order - b.order)
    };
  }
  return {
    ...task,
    steps: generateStepsForTask(task, now),
    updatedAt: now.toISOString()
  };
}

export function generateStepsForTask(task: Task, now = new Date()): TaskStep[] {
  const title = task.title.toLowerCase();
  let steps: string[];

  if (title.includes("washing") || title.includes("laundry")) {
    steps = [
      "Stand up.",
      "Pick up the laundry basket.",
      "Carry it to the washing machine.",
      "Put the clothes into the machine.",
      "Add detergent.",
      "Choose the usual wash setting.",
      "Press start."
    ];
  } else {
    steps = templates[inferTaskCategory(task)] ?? templates.generic;
  }

  return steps.map((step, index) => createTaskStep(step, index + 1, now));
}

export function getNextAction(task: Task, blocker?: BlockerId, veryLowEnergy = false) {
  const prepared = ensureTaskSteps(task);
  const step = prepared.steps.find((candidate) => !candidate.completed);
  const baseAction = step?.text ?? "Check whether the task is actually finished.";

  if (blocker === "worriedBadly") {
    return {
      stepId: step?.id,
      action: makeDraftAction(baseAction, prepared),
      note: "This version does not need to be good. It only needs to exist."
    };
  }

  if (veryLowEnergy) {
    return {
      stepId: step?.id,
      action: makeLowerEnergyAction(baseAction, prepared),
      note: "Preparation counts as progress."
    };
  }

  return { stepId: step?.id, action: baseAction };
}

export function validateAction(action: string): ActionValidation {
  const trimmed = action.trim();
  if (!trimmed) return { valid: false, reason: "empty" };

  const lower = trimmed.toLowerCase().replace(/[.!?]$/, "");
  if (vagueActions.includes(lower)) return { valid: false, reason: "vague" };

  const split = splitMeaningfulActions(trimmed);
  if (split.length > 1) return { valid: false, reason: "multiple-actions", split };

  const firstWord = lower.split(/\s+/)[0];
  if (!actionVerbs.includes(firstWord)) return { valid: false, reason: "missing-verb" };

  return { valid: true };
}

export function splitMeaningfulActions(action: string) {
  const trimmed = action.trim().replace(/[.!?]$/, "");
  const pieces = trimmed
    .split(/\s+(?:and|then)\s+/i)
    .map((piece) => piece.trim())
    .filter(Boolean);

  if (pieces.length <= 1) return [normaliseStepText(trimmed)];
  return pieces.map((piece) => normaliseStepText(piece));
}

export function makeSmallerAction(action: string) {
  const validation = validateAction(action);
  if (validation.reason === "multiple-actions" && validation.split?.[0]) return validation.split[0];
  if (/open/i.test(action)) return "Put your hand on the device.";
  if (/write/i.test(action)) return "Write one rough sentence.";
  if (/find/i.test(action)) return "Open the place where you would look first.";
  if (/walk|carry|move/i.test(action)) return "Stand up.";
  if (/send|call/i.test(action)) return "Write the purpose in one sentence.";
  return "Put one needed item where you can see it.";
}

export function makeLowerEnergyAction(action: string, task?: Task) {
  const text = `${task?.title ?? ""} ${action}`.toLowerCase();
  if (/laptop|computer|application|form|document|file/.test(text)) return "Open the file and leave it ready.";
  if (/phone|call|number/.test(text)) return "Write the phone number on a note.";
  if (/wash|laundry|kitchen|clean|bin/.test(text)) return "Put one item where it needs to go.";
  if (/charge|battery/.test(text)) return "Put the charger where you can see it.";
  return makeSmallerAction(action);
}

export function simplifyAction(action: string) {
  const lower = action.toLowerCase();
  if (lower.startsWith("open")) return "Open it.";
  if (lower.startsWith("find")) return "Find it.";
  if (lower.startsWith("write")) return "Write one sentence.";
  if (lower.startsWith("put")) return "Put it there.";
  if (lower.startsWith("walk")) return "Walk there.";
  return makeSmallerAction(action);
}

export function makeDraftAction(action: string, task: Task) {
  const text = `${task.title} ${action}`.toLowerCase();
  if (/email|message|reply|send/.test(text)) return "Write a rough first sentence that will not be sent.";
  if (/application|form/.test(text)) return "Fill in only one factual field.";
  if (/edit|video|creative|write/.test(text)) return "Create a deliberately rough placeholder.";
  if (/document|report/.test(text)) return "Save a duplicate before editing.";
  return "Find one example before doing the real version.";
}

const templates: Record<TaskCategory, string[]> = {
  communication: [
    "Open the relevant app.",
    "Find the person or conversation.",
    "Write a rough first sentence.",
    "Complete a rough draft.",
    "Review only for essential clarity.",
    "Send the message."
  ],
  cleaning: [
    "Move to the relevant location.",
    "Choose one visible category.",
    "Move one item.",
    "Continue for the current timer period.",
    "Stop or choose the next category."
  ],
  administrative: [
    "Find the relevant document, website or message.",
    "Open it.",
    "Locate the first unanswered field or required action.",
    "Complete one field or action.",
    "Save progress."
  ],
  creative: [
    "Open the relevant file or tool.",
    "Create a deliberately rough placeholder.",
    "Add one small element.",
    "Continue without editing.",
    "Review later."
  ],
  research: [
    "Write the exact question being answered.",
    "Open one suitable source.",
    "Collect one useful fact.",
    "Record the source.",
    "Decide whether another source is necessary."
  ],
  phone: [
    "Find the number.",
    "Write the one-sentence purpose of the call.",
    "Write any essential reference number.",
    "Press call.",
    "Record the result."
  ],
  leaving: ["Stand up.", "Find essential items.", "Put on shoes.", "Move to the door.", "Leave."],
  generic: ["Write the first physical action.", "Open or pick up the first item.", "Do that one action."]
};
