import { createTask } from "./taskFactory";
import { makeLowerEnergyAction, makeSmallerAction, simplifyAction } from "./taskBreakdown";
import type { Session, StuckReason, Task } from "./types";

export type Intervention = {
  message: string;
  action?: string;
  interventionId: string;
  choices?: string[];
};

export function getStuckIntervention(reason: StuckReason, currentAction: string, task?: Task): Intervention {
  switch (reason) {
    case "stillCannotStart":
      return {
        interventionId: "start-reduction",
        message: "Let this become a movement or setup action.",
        action: reduceToMovement(currentAction, task),
        choices: ["Start a 5-second countdown", "Continue now"]
      };
    case "doNotUnderstand":
      return {
        interventionId: "clarify-action",
        message: "Here is the same action with less language.",
        action: simplifyAction(currentAction),
        choices: ["What to do", "Where to do it", "What item I need", "What finished looks like"]
      };
    case "tooBig":
      return {
        interventionId: "split-smaller",
        message: "Here is a smaller version.",
        action: makeSmallerAction(currentAction)
      };
    case "distracted":
      return {
        interventionId: "return-from-distraction",
        message: "You have returned. The next action is still:",
        action: currentAction,
        choices: ["Continue now", "Start a 180-second focus period", "Remove the distraction", "Choose a different action"]
      };
    case "overwhelmed":
      return {
        interventionId: "overwhelm-reduction",
        message: "Would it help to make the action smaller, slower or different?",
        action: makeSmallerAction(currentAction),
        choices: ["Smaller", "Slower", "Different", "Stop for now"]
      };
    case "afraidWrong":
      return {
        interventionId: "rough-draft",
        message: "This version does not need to be good. It only needs to exist.",
        action: "Make a temporary placeholder."
      };
    case "ranOutEnergy":
      return {
        interventionId: "lower-energy",
        message: "Do you want a lower-energy step or to stop?",
        action: makeLowerEnergyAction(currentAction, task),
        choices: ["Give me a lower-energy step", "Save my place and stop", "Choose a different low-energy task"]
      };
    case "missingNeed":
      return {
        interventionId: "missing-prerequisite",
        message: "We can save this task and create the thing it depends on.",
        action: "Write down what is missing."
      };
    case "discoveredTask":
      return {
        interventionId: "capture-distraction",
        message: "Capture it, then come back here.",
        action: currentAction
      };
    case "somethingElse":
    default:
      return {
        interventionId: "other-route",
        message: "Choose the easiest adjustment.",
        action: makeSmallerAction(currentAction),
        choices: ["Make the action smaller", "Explain it differently", "Choose another route", "Pause it", "Choose another task"]
      };
  }
}

export function createMissingPrerequisite(task: Task, missing: string, now = new Date()) {
  const label = missing.trim() || "missing item";
  const prerequisite = createTask(
    {
      title: `Get ${label} for ${task.title}`,
      description: `Prerequisite created because "${task.title}" cannot continue without ${label}.`,
      importance: task.importance,
      urgency: task.urgency,
      estimatedMinutes: 5,
      energyRequired: "low",
      cognitiveLoad: "low",
      emotionalLoad: "low",
      physicalLoad: "low",
      parentTaskId: task.id,
      steps: [`Find or request ${label}.`]
    },
    now
  );

  return {
    prerequisite,
    blockedTask: {
      ...task,
      status: "paused" as const,
      blockedBy: prerequisite.id,
      updatedAt: now.toISOString()
    }
  };
}

export function captureDiscoveredTask(
  tasks: Task[],
  session: Session,
  title: string,
  urgent: boolean,
  now = new Date()
) {
  const newTask = createTask(
    {
      title,
      urgency: urgent ? 3 : 1,
      importance: urgent ? 3 : 2,
      estimatedMinutes: urgent ? 15 : 10,
      energyRequired: "medium",
      cognitiveLoad: "medium",
      emotionalLoad: "medium",
      physicalLoad: "low"
    },
    now
  );
  const nextSession: Session = urgent
    ? {
        ...session,
        selectedTaskId: newTask.id,
        state: "TASK_CONFIRMATION",
        stateHistory: [...session.stateHistory, "TASK_CONFIRMATION"],
        updatedAt: now.toISOString()
      }
    : {
        ...session,
        state: "ACTION_READY",
        stateHistory:
          session.stateHistory[session.stateHistory.length - 1] === "ACTION_READY"
            ? session.stateHistory
            : [...session.stateHistory, "ACTION_READY"],
        updatedAt: now.toISOString()
      };

  return { tasks: [...tasks, newTask], session: nextSession, newTask };
}

function reduceToMovement(currentAction: string, task?: Task) {
  const text = `${task?.title ?? ""} ${currentAction}`.toLowerCase();
  if (/laptop|computer|application|form|email|message|website|file/.test(text)) return "Put your hand on the laptop.";
  if (/kitchen|washing|laundry|bin|outside|door/.test(text)) return "Stand up.";
  if (/envelope|paper|document|receipt/.test(text)) return "Pick up the document.";
  return "Move towards the thing you need.";
}
