import type { BlockerId, Session, SessionEvent, SessionState, Task } from "../engine/types";
import type { View } from "../components/BottomNav";

export type VoiceCommand =
  | { type: "NO_MATCH"; transcript: string; message: string }
  | { type: "START_SESSION" }
  | { type: "EXIT_SESSION" }
  | { type: "NAVIGATE"; view: View }
  | { type: "ADD_TASK"; title: string; start?: boolean }
  | { type: "LOAD_SAMPLES" }
  | { type: "REPEAT_PROMPT" }
  | { type: "SESSION_EVENT"; event: SessionEvent };

export type VoiceContext = {
  view: View;
  session?: Session;
  tasks: Task[];
};

const numberWords: Record<string, number> = {
  five: 5,
  fifteen: 15,
  quarter: 15,
  thirty: 30,
  half: 30,
  sixty: 60,
  hour: 60,
  unknown: 15
};

export function parseVoiceCommand(transcript: string, context: VoiceContext): VoiceCommand {
  const original = transcript.trim();
  const text = normalise(original);
  const session = context.session;
  const state = session?.state;

  if (!text) return noMatch(original, "I did not hear anything clearly.");

  if (matches(text, ["repeat", "say that again", "what was that"])) return { type: "REPEAT_PROMPT" };
  if (matches(text, ["go to start", "open start", "show start"])) return { type: "NAVIGATE", view: "start" };
  if (matches(text, ["go to tasks", "open tasks", "show tasks", "task inbox"])) return { type: "NAVIGATE", view: "tasks" };
  if (matches(text, ["go to history", "open history", "show history"])) return { type: "NAVIGATE", view: "history" };
  if (matches(text, ["go to settings", "open settings", "show settings"])) return { type: "NAVIGATE", view: "settings" };
  if (matches(text, ["load sample tasks", "load samples", "sample tasks"])) return { type: "LOAD_SAMPLES" };
  if (matches(text, ["exit session", "leave session", "stop session"])) return { type: "EXIT_SESSION" };

  const explicitTask = extractExplicitTaskTitle(text);
  if (explicitTask) {
    const command = { type: "ADD_TASK" as const, title: sentenceCase(explicitTask) };
    return shouldStartAfterCapture(text) ? { ...command, start: true } : command;
  }

  if (!session || !isLiveSessionState(state)) {
    const startTask = extractStartTaskTitle(text);
    if (startTask) return { type: "ADD_TASK", title: sentenceCase(startTask), start: true };

    if (matches(text, ["help me start", "help me get started", "get started", "start", "begin", "start session", "start now", "choose a task"])) {
      return { type: "START_SESSION" };
    }

    const inferredTask = inferTaskTitle(text, context);
    if (inferredTask) return { type: "ADD_TASK", title: sentenceCase(inferredTask) };

    return noMatch(original, "Try saying “add task” followed by the task, or “help me start”.");
  }

  const stateCommand = parseStateCommand(text, original, session);
  if (stateCommand) return stateCommand;

  return noMatch(original, "I heard you, but I do not know what to do with that yet.");
}

export function getVoicePrompt(context: VoiceContext): string {
  const session = context.session;
  const selected = context.tasks.find((task) => task.id === session?.selectedTaskId);

  if (!session || !isLiveSessionState(session.state)) {
    return context.tasks.some((task) => task.status !== "completed" && task.status !== "abandoned")
      ? "What do you want help starting?"
      : "What is taking up space in your head?";
  }

  switch (session.state) {
    case "URGENT_CHECK":
      return "Is there anything urgent or unsafe that must be handled now?";
    case "URGENT_CLARIFICATION":
      return session.inputs.immediateUrgency === "yes"
        ? "What is the urgent task?"
        : "Is anything due today, overdue, unsafe, or blocking another person?";
    case "TIME_CHECK":
      return "How much usable time do you have?";
    case "ENERGY_CHECK":
      return "How much energy do you have?";
    case "BLOCKER_CHECK":
      return "What is the main problem right now?";
    case "TASK_CONFIRMATION":
      return selected
        ? `I have chosen ${selected.title}. Do you want to begin?`
        : "I could not choose a task yet.";
    case "ACTION_READY":
    case "ACTION_ACTIVE":
      return session.currentAction
        ? `${selected ? `Task: ${selected.title}. ` : ""}Next action: ${session.currentAction}`
        : "What is the next action?";
    case "STUCK_REASON":
      return "What stopped you?";
    case "STUCK_INTERVENTION":
      return session.currentAction
        ? `${session.currentActionNote ?? "Here is a different route."} Next action: ${session.currentAction}.`
        : "Can you continue?";
    case "TASK_COMPLETION_CHECK":
      return "Is the task actually finished?";
    case "TASK_COMPLETE":
      return "Task complete. Do you want another task?";
    case "TASK_PAUSED":
      return "Your place is saved. What do you want to do next?";
    default:
      return "What do you need next?";
  }
}

function parseStateCommand(text: string, original: string, session: Session): VoiceCommand | null {
  switch (session.state) {
    case "URGENT_CHECK":
      if (text.includes("not sure") || text.includes("unsure") || text.includes("do not know")) {
        return sessionEvent({ type: "URGENT_CHECK", answer: "unsure" });
      }
      if (isYes(text)) return sessionEvent({ type: "URGENT_CHECK", answer: "yes" });
      if (isNo(text)) return sessionEvent({ type: "URGENT_CHECK", answer: "no" });
      return null;

    case "URGENT_CLARIFICATION":
      if (session.inputs.immediateUrgency === "yes") {
        return sessionEvent({ type: "URGENT_TASK", title: sentenceCase(stripFiller(text)) });
      }
      if (isYes(text)) return sessionEvent({ type: "URGENT_CLARIFICATION", urgent: true });
      if (isNo(text)) return sessionEvent({ type: "URGENT_CLARIFICATION", urgent: false });
      return null;

    case "TIME_CHECK": {
      const minutes = parseMinutes(text);
      return minutes ? sessionEvent({ type: "TIME_SELECTED", minutes }) : null;
    }

    case "ENERGY_CHECK": {
      if (text.includes("very low") || text.includes("almost no") || text.includes("exhausted")) {
        return sessionEvent({ type: "ENERGY_SELECTED", energy: "veryLow" });
      }
      if (text.includes("low")) return sessionEvent({ type: "ENERGY_SELECTED", energy: "low" });
      if (text.includes("medium") || text.includes("okay") || text.includes("fine")) {
        return sessionEvent({ type: "ENERGY_SELECTED", energy: "medium" });
      }
      if (text.includes("high")) return sessionEvent({ type: "ENERGY_SELECTED", energy: "high" });
      return null;
    }

    case "BLOCKER_CHECK": {
      const blocker = parseBlocker(text);
      return sessionEvent({ type: "BLOCKER_SELECTED", blocker, text: blocker === "somethingElse" ? original : undefined });
    }

    case "TASK_CONFIRMATION":
      if (text.includes("begin") || text.includes("start")) {
        return sessionEvent({ type: "CONFIRM_TASK", action: "begin" });
      }
      if (text.includes("choose something else") || text.includes("different task")) {
        return sessionEvent({ type: "CONFIRM_TASK", action: "chooseElse", reason: "voice request" });
      }
      if (text.includes("cannot") || text.includes("can't") || text.includes("reason")) {
        return sessionEvent({ type: "CONFIRM_TASK", action: "cannot", reason: original });
      }
      return null;

    case "ACTION_READY":
    case "ACTION_ACTIVE":
      return parseActionCommand(text, original, session);

    case "STUCK_REASON": {
      const discovered = extractAfter(text, ["discovered another task", "another task", "capture"]);
      if (discovered) {
        return sessionEvent({
          type: "CAPTURE_DISCOVERED",
          title: sentenceCase(discovered),
          urgent: text.includes("urgent") || text.includes("today")
        });
      }
      if (text.includes("cannot start") || text.includes("can't start") || text.includes("still cannot")) {
        return sessionEvent({ type: "STUCK_REASON", reason: "stillCannotStart" });
      }
      if (text.includes("understand") || text.includes("unclear")) {
        return sessionEvent({ type: "STUCK_REASON", reason: "doNotUnderstand" });
      }
      if (text.includes("too big") || text.includes("smaller")) {
        return sessionEvent({ type: "STUCK_REASON", reason: "tooBig" });
      }
      if (text.includes("missing") || text.includes("do not have") || text.includes("don't have") || text.includes("need")) {
        return sessionEvent({ type: "STUCK_REASON", reason: "missingNeed", details: stripMissing(text) });
      }
      if (text.includes("distracted")) return sessionEvent({ type: "STUCK_REASON", reason: "distracted" });
      if (text.includes("overwhelmed")) return sessionEvent({ type: "STUCK_REASON", reason: "overwhelmed" });
      if (text.includes("wrong") || text.includes("badly") || text.includes("afraid")) {
        return sessionEvent({ type: "STUCK_REASON", reason: "afraidWrong" });
      }
      if (text.includes("energy") || text.includes("tired") || text.includes("exhausted")) {
        return sessionEvent({ type: "STUCK_REASON", reason: "ranOutEnergy" });
      }
      return sessionEvent({ type: "STUCK_REASON", reason: "somethingElse", details: original });
    }

    case "STUCK_INTERVENTION":
      if (text.includes("continue") || text.includes("resume")) return sessionEvent({ type: "RESUME_ACTION" });
      if (text.includes("stuck")) return sessionEvent({ type: "STUCK" });
      if ((text.includes("pause") || text.includes("stop")) && session.actionTimerExpiredAt) {
        return sessionEvent({ type: "PAUSE", note: original });
      }
      return null;

    case "TASK_COMPLETION_CHECK":
      if (isYes(text) || text.includes("finished") || text.includes("complete")) {
        return sessionEvent({ type: "TASK_COMPLETION", answer: "yes" });
      }
      if (text.includes("almost") || text.includes("one thing")) {
        return sessionEvent({ type: "TASK_COMPLETION", answer: "almost", remainingText: stripFiller(text) });
      }
      if (text.includes("not sure") || text.includes("unsure")) {
        return sessionEvent({ type: "TASK_COMPLETION", answer: "unsure" });
      }
      return null;

    case "TASK_COMPLETE":
      if (text.includes("choose") || text.includes("another") || text.includes("start")) {
        return { type: "START_SESSION" };
      }
      if (text.includes("finished") || text.includes("done for now")) return { type: "EXIT_SESSION" };
      return null;

    case "TASK_PAUSED":
      if (text.includes("resume") && session.selectedTaskId) {
        return sessionEvent({ type: "RESUME_PAUSED", taskId: session.selectedTaskId });
      }
      if (text.includes("start") || text.includes("choose")) return { type: "START_SESSION" };
      if (text.includes("finished") || text.includes("done for now")) return { type: "EXIT_SESSION" };
      return null;

    default:
      return null;
  }
}

function parseActionCommand(text: string, original: string, session: Session): VoiceCommand | null {
  if (matches(text, ["done", "complete", "completed", "finished", "that is done"])) {
    return sessionEvent({ type: "DONE_ACTION" });
  }
  if (text.includes("stuck") || text.includes("help")) return sessionEvent({ type: "STUCK" });
  if ((text.includes("pause") || text.includes("stop for now")) && session.actionTimerExpiredAt) {
    return sessionEvent({ type: "PAUSE", note: original });
  }
  return null;
}

function parseBlocker(text: string): BlockerId {
  if (text.includes("decide")) return "cannotDecide";
  if (text.includes("start")) return "cannotStart";
  if (text.includes("too big") || text.includes("big")) return "tooBig";
  if (text.includes("overwhelmed")) return "overwhelmed";
  if (text.includes("distracted")) return "distracted";
  if (text.includes("remember")) return "cannotRemember";
  if (text.includes("understand")) return "doNotUnderstand";
  if (text.includes("wrong") || text.includes("badly") || text.includes("worried")) return "worriedBadly";
  if (text.includes("no energy") || text.includes("almost no") || text.includes("exhausted")) return "veryLowEnergy";
  return "somethingElse";
}

function parseMinutes(text: string) {
  const numeric = text.match(/\b(5|15|30|60|120)\b/);
  if (numeric) return Number(numeric[1]);
  if (text.includes("more than") || text.includes("over an hour")) return 120;
  if (text.includes("do not know") || text.includes("don't know") || text.includes("not know")) return 15;
  for (const [word, minutes] of Object.entries(numberWords)) {
    if (text.includes(word)) return minutes;
  }
  return null;
}

function sessionEvent(event: SessionEvent): VoiceCommand {
  return { type: "SESSION_EVENT", event };
}

function noMatch(transcript: string, message: string): VoiceCommand {
  return { type: "NO_MATCH", transcript, message };
}

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matches(text: string, phrases: string[]) {
  return phrases.some((phrase) => text === phrase || text.includes(phrase));
}

function extractExplicitTaskTitle(text: string) {
  const markerTitle = extractAfter(text, [
    "add task",
    "add a task",
    "add this task",
    "new task",
    "create task",
    "create a task",
    "capture task",
    "save task",
    "task is",
    "the task is",
    "remember to",
    "remind me to",
    "write down that",
    "write down",
    "note down that",
    "note down",
    "make a note to"
  ]);

  if (markerTitle) return removeStartSuffix(markerTitle);

  const patternMatches = [
    text.match(/^(?:please\s+)?(?:can you\s+)?add\s+(.+?)(?:\s+to\s+(?:my\s+)?(?:task\s+list|tasks|list))?(?:\s+please)?$/),
    text.match(/^(?:please\s+)?put\s+(.+?)\s+on\s+(?:my\s+)?(?:task\s+list|tasks|list)$/),
    text.match(/^(?:please\s+)?save\s+(.+?)\s+as\s+(?:a\s+)?task$/),
    text.match(/^(?:please\s+)?make\s+(?:a\s+)?(?:new\s+)?task\s+(?:to\s+)?(.+)$/)
  ];
  const patternTitle = patternMatches.find(Boolean)?.[1];
  return patternTitle ? removeStartSuffix(patternTitle) : null;
}

function extractStartTaskTitle(text: string) {
  if (matches(text, ["help me start", "help me get started", "get me started", "start me on"])) {
    return extractAfter(text, [
      "help me get started with",
      "help me get started on",
      "help me start with",
      "help me start on",
      "help me start",
      "get me started with",
      "get me started on",
      "start me on"
    ]);
  }

  const directStart = text.match(/^(?:start|begin)\s+(?!session\b|now\b)(.+)$/);
  return directStart?.[1] ?? null;
}

function inferTaskTitle(text: string, context: VoiceContext) {
  const taskFromNeed = extractAfter(text, [
    "i need to",
    "i need",
    "need to",
    "i have to",
    "i've got to",
    "i got to",
    "got to",
    "i should",
    "should",
    "i must",
    "must",
    "i am trying to",
    "i'm trying to",
    "trying to"
  ]);
  if (taskFromNeed) return taskFromNeed;

  if (context.view !== "start" && context.view !== "tasks") return null;
  if (!isBareTaskCandidate(text)) return null;
  return text;
}

function isBareTaskCandidate(text: string) {
  if (text.length < 4) return false;
  if (matches(text, ["yes", "yeah", "yep", "no", "nope", "not sure", "repeat", "stop", "exit", "cancel"])) {
    return false;
  }
  if (matches(text, ["what can you do", "how does this work", "thank you", "thanks", "hello", "hi"])) {
    return false;
  }

  const words = text.split(" ").filter(Boolean);
  if (words.length >= 2) return true;

  return [
    "laundry",
    "washing",
    "bins",
    "dishes",
    "email",
    "emails",
    "homework",
    "admin",
    "shopping"
  ].includes(text);
}

function shouldStartAfterCapture(text: string) {
  return matches(text, [
    "and help me start",
    "then help me start",
    "and start it",
    "then start it",
    "and get started",
    "then get started"
  ]);
}

function removeStartSuffix(text: string) {
  return text
    .replace(/\s+(?:and|then)\s+(?:help me start|get started|start it|start this)$/i, "")
    .trim();
}

function isYes(text: string) {
  if (text.includes("not urgent") || text.includes("nothing urgent")) return false;
  return ["yes", "yeah", "yep", "it is urgent", "there is"].some((phrase) => text === phrase || text.includes(phrase));
}

function isNo(text: string) {
  return text === "no" || text === "nope" || text.includes("not urgent") || text.includes("nothing urgent");
}

function extractAfter(text: string, markers: string[]) {
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index >= 0) {
      const result = text.slice(index + marker.length).trim();
      return result.length > 1 ? result : null;
    }
  }
  return null;
}

function stripFiller(text: string) {
  return text
    .replace(/^(the task is|it is|it's|i need to|need to|please|can you|almost|one thing remains)\s+/i, "")
    .trim();
}

function stripMissing(text: string) {
  return text
    .replace(/^(i am missing|i'm missing|missing|i do not have|i don't have|i need|need)\s+/i, "")
    .trim();
}

function sentenceCase(text: string) {
  const stripped = stripFiller(text);
  return stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : "Untitled task";
}

function isLiveSessionState(state?: SessionState) {
  return Boolean(state && state !== "WELCOME" && state !== "SESSION_COMPLETE");
}
