import { captureDiscoveredTask, createMissingPrerequisite, getStuckIntervention } from "./blockerResponses";
import { ensureTaskSteps, getNextAction } from "./taskBreakdown";
import { createId, createTask, createTaskStep, touchTask } from "./taskFactory";
import { selectTask } from "./taskScoring";
import type {
  BlockerId,
  EnergyLevel,
  SelectionContext,
  Session,
  SessionEvent,
  SessionRecord,
  SessionState,
  Task,
  TransitionResult
} from "./types";

export const startLadder = [
  "Put both feet on the floor.",
  "Count down from five.",
  "Move towards the thing you need.",
  "Open or pick up the first item."
];

export function createSession(now = new Date()): Session {
  return {
    id: createId("session", now),
    state: "WELCOME",
    inputs: {},
    rejectedTaskCounts: {},
    pausedTaskIds: [],
    interventionsUsed: [],
    actionsCompleted: [],
    stateHistory: ["WELCOME"],
    startedAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

export function transition(
  session: Session,
  tasks: Task[],
  event: SessionEvent,
  now = new Date()
): TransitionResult {
  switch (event.type) {
    case "START":
      return { session: move(session, "URGENT_CHECK", now), tasks };

    case "URGENT_CHECK": {
      const next = {
        ...session,
        inputs: { ...session.inputs, immediateUrgency: event.answer },
        updatedAt: now.toISOString()
      };
      if (event.answer === "yes") return { session: move(next, "URGENT_CLARIFICATION", now), tasks };
      if (event.answer === "unsure") return { session: move(next, "URGENT_CLARIFICATION", now), tasks };
      return { session: move(next, "TIME_CHECK", now), tasks };
    }

    case "URGENT_CLARIFICATION": {
      const next = {
        ...session,
        inputs: { ...session.inputs, urgentClarification: event.urgent },
        updatedAt: now.toISOString()
      };
      return { session: move(next, "TIME_CHECK", now), tasks };
    }

    case "URGENT_TASK": {
      let nextTasks = tasks;
      let selectedTaskId = event.taskId;
      if (!selectedTaskId && event.title?.trim()) {
        const urgentTask = createTask(
          {
            title: event.title,
            urgency: 3,
            importance: 3,
            estimatedMinutes: 15,
            energyRequired: "medium",
            cognitiveLoad: "medium",
            emotionalLoad: "medium",
            physicalLoad: "low"
          },
          now
        );
        selectedTaskId = urgentTask.id;
        nextTasks = [...tasks, urgentTask];
      }
      return {
        session: move({ ...session, selectedTaskId, updatedAt: now.toISOString() }, "TIME_CHECK", now),
        tasks: nextTasks
      };
    }

    case "TIME_SELECTED":
      return {
        session: move(
          {
            ...session,
            inputs: { ...session.inputs, availableMinutes: event.minutes || 15 },
            updatedAt: now.toISOString()
          },
          "ENERGY_CHECK",
          now
        ),
        tasks
      };

    case "ENERGY_SELECTED":
      return {
        session: move(
          {
            ...session,
            inputs: { ...session.inputs, energy: event.energy },
            updatedAt: now.toISOString()
          },
          "BLOCKER_CHECK",
          now
        ),
        tasks
      };

    case "BLOCKER_SELECTED": {
      const withBlocker = {
        ...session,
        inputs: {
          ...session.inputs,
          initialBlocker: event.blocker,
          initialBlockerText: event.text?.trim() || undefined
        },
        updatedAt: now.toISOString()
      };
      return chooseTask(withBlocker, tasks, now);
    }

    case "CONFIRM_TASK": {
      if (event.action === "begin") return beginSelectedTask(session, tasks, now);
      if (event.action === "chooseElse" || event.action === "cannot") {
        return rejectAndChooseAgain(session, tasks, event.reason ?? "not suitable now", now);
      }
      return { session, tasks };
    }

    case "REJECT_SELECTED":
      return rejectAndChooseAgain(session, tasks, event.reason, now);

    case "DONE_ACTION":
      return completeCurrentAction(session, tasks, now);

    case "TASK_COMPLETION":
      return completeOrExtendTask(session, tasks, event.answer, event.remainingText, now);

    case "STUCK":
      return { session: move(session, "STUCK_REASON", now), tasks };

    case "STUCK_REASON":
      return handleStuckReason(session, tasks, event.reason, event.details, event.missingType, now);

    case "RESUME_ACTION":
      return { session: move(session, "ACTION_READY", now), tasks };

    case "ACTION_TIMER_STARTED":
      if (session.actionTimerEndsAt) return { session, tasks };
      return {
        session: {
          ...session,
          actionTimerStartedAt: event.startedAt,
          actionTimerEndsAt: event.endsAt,
          actionTimerExpiredAt: undefined,
          actionTimerNotificationSentAt: undefined,
          updatedAt: now.toISOString()
        },
        tasks
      };

    case "ACTION_TIMER_EXPIRED":
      return {
        session: {
          ...session,
          actionTimerExpiredAt: session.actionTimerExpiredAt ?? event.expiredAt,
          interventionsUsed: addUnique(session.interventionsUsed, "action-timer-ended"),
          updatedAt: now.toISOString()
        },
        tasks
      };

    case "ACTION_TIMER_NOTIFICATION_SENT":
      return {
        session: {
          ...session,
          actionTimerNotificationSentAt: session.actionTimerNotificationSentAt ?? event.sentAt,
          updatedAt: now.toISOString()
        },
        tasks
      };

    case "PAUSE":
      if (hasRunningActionTimer(session, now)) return { session, tasks };
      return pauseSession(session, tasks, event.note, now);

    case "CAPTURE_DISCOVERED": {
      const captured = captureDiscoveredTask(tasks, session, event.title, Boolean(event.urgent), now);
      return { session: captured.session, tasks: captured.tasks };
    }

    case "RESUME_PAUSED":
      return resumePausedTask(session, tasks, event.taskId, now);

    default:
      return { session, tasks };
  }
}

export function chooseTask(session: Session, tasks: Task[], now = new Date()): TransitionResult {
  if (session.selectedTaskId && tasks.some((task) => task.id === session.selectedTaskId)) {
    return {
      session: move({ ...session, updatedAt: now.toISOString() }, "TASK_CONFIRMATION", now),
      tasks
    };
  }

  const context = getSelectionContext(session, now);
  const result = selectTask(tasks, context);
  let nextTasks = tasks;
  let selectedTaskId = result.task?.id;

  if (!selectedTaskId && context.energy === "veryLow") {
    const prepTask = createTask(
      {
        title: "Prepare one important future task",
        estimatedMinutes: 5,
        energyRequired: "low",
        cognitiveLoad: "low",
        emotionalLoad: "low",
        physicalLoad: "low",
        steps: ["Place one needed item somewhere visible."]
      },
      now
    );
    nextTasks = [...tasks, prepTask];
    selectedTaskId = prepTask.id;
    result.debug.selectedTaskId = selectedTaskId;
  }

  return {
    session: move(
      {
        ...session,
        selectedTaskId,
        lastSelection: result.debug,
        updatedAt: now.toISOString()
      },
      selectedTaskId ? "TASK_CONFIRMATION" : "WELCOME",
      now
    ),
    tasks: nextTasks
  };
}

export function getSelectionContext(session: Session, now = new Date()): SelectionContext {
  return {
    availableMinutes: session.inputs.availableMinutes ?? 15,
    energy: session.inputs.energy ?? "medium",
    initialBlocker: session.inputs.initialBlocker,
    now,
    currentLocation: session.inputs.currentLocation,
    availableItems: session.inputs.availableItems,
    rejectedTaskCounts: session.rejectedTaskCounts,
    pausedTaskIds: session.pausedTaskIds
  };
}

function beginSelectedTask(session: Session, tasks: Task[], now: Date): TransitionResult {
  const task = tasks.find((candidate) => candidate.id === session.selectedTaskId);
  if (!task) return { session: move(session, "WELCOME", now), tasks };

  const taskWithSteps = ensureTaskSteps({ ...task, status: "active" }, now);
  const nextTasks = tasks.map((candidate) =>
    candidate.id === task.id ? touchTask(taskWithSteps, { status: "active", steps: taskWithSteps.steps }, now) : candidate
  );

  if (session.inputs.initialBlocker === "cannotStart") {
    return {
      session: move(
        {
          ...clearActionTimer(session),
          currentAction: startLadder[0],
          currentStepId: undefined,
          startLadderIndex: 0,
          interventionsUsed: addUnique(session.interventionsUsed, "start-ladder"),
          updatedAt: now.toISOString()
        },
        "ACTION_READY",
        now
      ),
      tasks: nextTasks
    };
  }

  return setNextTaskAction(session, nextTasks, task.id, now);
}

function setNextTaskAction(session: Session, tasks: Task[], taskId: string, now: Date): TransitionResult {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) return { session: move(session, "WELCOME", now), tasks };
  const withSteps = ensureTaskSteps(task, now);
  const next = getNextAction(
    withSteps,
    session.inputs.initialBlocker,
    session.inputs.energy === "veryLow"
  );
  const nextTasks = tasks.map((candidate) => (candidate.id === taskId ? withSteps : candidate));
  return {
    session: move(
      {
        ...clearActionTimer(session),
        selectedTaskId: taskId,
        currentStepId: next.stepId,
        currentAction: next.action,
        currentActionNote: next.note,
        updatedAt: now.toISOString()
      },
      "ACTION_READY",
      now
    ),
    tasks: nextTasks
  };
}

function completeCurrentAction(session: Session, tasks: Task[], now: Date): TransitionResult {
  if (typeof session.startLadderIndex === "number") {
    const nextIndex = session.startLadderIndex + 1;
    if (nextIndex < startLadder.length) {
      return {
        session: move(
          {
            ...clearActionTimer(session),
            currentAction: startLadder[nextIndex],
            startLadderIndex: nextIndex,
            actionsCompleted: [...session.actionsCompleted, session.currentAction ?? startLadder[nextIndex - 1]],
            updatedAt: now.toISOString()
          },
          "ACTION_READY",
          now
        ),
        tasks
      };
    }

    return setNextTaskAction(
      {
        ...session,
        startLadderIndex: undefined,
        actionsCompleted: [...session.actionsCompleted, session.currentAction ?? startLadder[startLadder.length - 1]]
      },
      tasks,
      session.selectedTaskId ?? "",
      now
    );
  }

  const task = tasks.find((candidate) => candidate.id === session.selectedTaskId);
  if (!task) return { session, tasks };
  const withSteps = ensureTaskSteps(task, now);
  const currentStepId = session.currentStepId ?? withSteps.steps.find((step) => !step.completed)?.id;
  const nextSteps = withSteps.steps.map((step) =>
    step.id === currentStepId ? { ...step, completed: true } : step
  );
  const completedAction = withSteps.steps.find((step) => step.id === currentStepId)?.text ?? session.currentAction;
  const updatedTask = touchTask(withSteps, { steps: nextSteps }, now);
  const nextTasks = tasks.map((candidate) => (candidate.id === updatedTask.id ? updatedTask : candidate));

  if (nextSteps.every((step) => step.completed)) {
    return {
      session: move(
        {
          ...clearActionTimer(session),
          actionsCompleted: completedAction ? [...session.actionsCompleted, completedAction] : session.actionsCompleted,
          currentAction: undefined,
          currentStepId: undefined,
          updatedAt: now.toISOString()
        },
        "TASK_COMPLETION_CHECK",
        now
      ),
      tasks: nextTasks
    };
  }

  const nextSession = {
    ...session,
    actionsCompleted: completedAction ? [...session.actionsCompleted, completedAction] : session.actionsCompleted,
    updatedAt: now.toISOString()
  };
  return setNextTaskAction(nextSession, nextTasks, updatedTask.id, now);
}

function completeOrExtendTask(
  session: Session,
  tasks: Task[],
  answer: "yes" | "almost" | "unsure",
  remainingText: string | undefined,
  now: Date
): TransitionResult {
  const task = tasks.find((candidate) => candidate.id === session.selectedTaskId);
  if (!task) return { session, tasks };

  if (answer === "almost") {
    const newStep = createTaskStep(remainingText || "Do the one remaining thing.", task.steps.length + 1, now);
    const updatedTask = touchTask(task, { steps: [...task.steps, newStep], status: "active" }, now);
    return setNextTaskAction(
      { ...session, completionReflection: false },
      tasks.map((candidate) => (candidate.id === task.id ? updatedTask : candidate)),
      task.id,
      now
    );
  }

  if (answer === "unsure" && !session.completionReflection) {
    return {
      session: move({ ...session, completionReflection: true, updatedAt: now.toISOString() }, "TASK_COMPLETION_CHECK", now),
      tasks
    };
  }

  const completedTask = touchTask(task, { status: "completed", completedAt: now.toISOString() }, now);
  const record = buildHistoryRecord(session, completedTask, "completed", now);
  return {
    session: move(
      {
        ...session,
        selectedTaskId: task.id,
        updatedAt: now.toISOString()
      },
      "TASK_COMPLETE",
      now
    ),
    tasks: tasks.map((candidate) => (candidate.id === task.id ? completedTask : candidate)),
    historyRecord: record
  };
}

function handleStuckReason(
  session: Session,
  tasks: Task[],
  reason: Session["lastStuckReason"],
  details: string | undefined,
  missingType: string | undefined,
  now: Date
): TransitionResult {
  if (!reason) return { session, tasks };
  const task = tasks.find((candidate) => candidate.id === session.selectedTaskId);

  if (reason === "missingNeed" && task) {
    const { prerequisite, blockedTask } = createMissingPrerequisite(task, details || missingType || "what is missing", now);
    return {
      session: move(
        {
          ...session,
          selectedTaskId: prerequisite.id,
          lastStuckReason: reason,
          missingItem: details || missingType,
          interventionsUsed: addUnique(session.interventionsUsed, "missing-prerequisite"),
          updatedAt: now.toISOString()
        },
        "TASK_CONFIRMATION",
        now
      ),
      tasks: tasks.map((candidate) => (candidate.id === task.id ? blockedTask : candidate)).concat(prerequisite)
    };
  }

  const intervention = getStuckIntervention(reason, session.currentAction ?? "", task);
  return {
    session: move(
      {
        ...session,
        lastStuckReason: reason,
        currentAction: intervention.action ?? session.currentAction,
        currentActionNote: intervention.message,
        interventionsUsed: addUnique(session.interventionsUsed, intervention.interventionId),
        updatedAt: now.toISOString()
      },
      "STUCK_INTERVENTION",
      now
    ),
    tasks
  };
}

function pauseSession(session: Session, tasks: Task[], note: string | undefined, now: Date): TransitionResult {
  const task = tasks.find((candidate) => candidate.id === session.selectedTaskId);
  const nextTasks = task
    ? tasks.map((candidate) =>
        candidate.id === task.id
          ? touchTask(candidate, { status: "paused", blockedBy: candidate.blockedBy }, now)
          : candidate
      )
    : tasks;

  const pausedSession = move(
    {
      ...session,
      pauseNote: note?.trim() || undefined,
      pausedTaskIds: session.selectedTaskId
        ? addUnique(session.pausedTaskIds, session.selectedTaskId)
        : session.pausedTaskIds,
      updatedAt: now.toISOString()
    },
    "TASK_PAUSED",
    now
  );

  return {
    session: pausedSession,
    tasks: nextTasks,
    historyRecord: task ? buildHistoryRecord(pausedSession, task, "paused", now) : undefined
  };
}

function resumePausedTask(session: Session, tasks: Task[], taskId: string, now: Date): TransitionResult {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) return { session, tasks };
  const activeTask = ensureTaskSteps({ ...task, status: "active" }, now);
  const nextTasks = tasks.map((candidate) => (candidate.id === taskId ? activeTask : candidate));
  const next = getNextAction(activeTask, session.inputs.initialBlocker, session.inputs.energy === "veryLow");
  return {
    session: move(
      {
        ...createSession(now),
        selectedTaskId: taskId,
        currentStepId: next.stepId,
        currentAction: next.action,
        currentActionNote: "You stopped here:",
        inputs: session.inputs,
        stateHistory: ["WELCOME"],
        updatedAt: now.toISOString()
      },
      "ACTION_READY",
      now
    ),
    tasks: nextTasks
  };
}

function rejectAndChooseAgain(session: Session, tasks: Task[], reason: string, now: Date): TransitionResult {
  const taskId = session.selectedTaskId;
  if (!taskId) return chooseTask(session, tasks, now);
  const rejectedTaskCounts = {
    ...session.rejectedTaskCounts,
    [taskId]: (session.rejectedTaskCounts[taskId] ?? 0) + 1
  };
  return chooseTask(
    {
      ...session,
      selectedTaskId: undefined,
      rejectedTaskCounts,
      currentActionNote: reason,
      updatedAt: now.toISOString()
    },
    tasks,
    now
  );
}

function buildHistoryRecord(
  session: Session,
  task: Task,
  result: SessionRecord["result"],
  now: Date
): SessionRecord {
  const started = new Date(session.startedAt);
  const durationSeconds = Math.max(0, Math.round((now.getTime() - started.getTime()) / 1000));
  return {
    id: createId("history", now),
    taskId: task.id,
    taskTitle: task.title,
    startedAt: session.startedAt,
    endedAt: now.toISOString(),
    statedEnergy: session.inputs.energy,
    availableTime: session.inputs.availableMinutes,
    initialBlocker: session.inputs.initialBlocker,
    actionsCompleted: session.actionsCompleted,
    interventionsUsed: session.interventionsUsed,
    result,
    durationSeconds
  };
}

function move(session: Session, state: SessionState, now: Date): Session {
  return {
    ...session,
    state,
    stateHistory:
      session.stateHistory[session.stateHistory.length - 1] === state
        ? session.stateHistory
        : [...session.stateHistory, state],
    updatedAt: now.toISOString()
  };
}

function clearActionTimer(session: Session): Session {
  return {
    ...session,
    actionTimerStartedAt: undefined,
    actionTimerEndsAt: undefined,
    actionTimerExpiredAt: undefined,
    actionTimerNotificationSentAt: undefined
  };
}

function hasRunningActionTimer(session: Session, now: Date): boolean {
  if (!session.actionTimerEndsAt || session.actionTimerExpiredAt) return false;
  const endTime = new Date(session.actionTimerEndsAt).getTime();
  return !Number.isNaN(endTime) && endTime > now.getTime();
}

function addUnique<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items : [...items, item];
}

export function energyLabelToValue(energy: EnergyLevel) {
  return { veryLow: 0, low: 1, medium: 2, high: 3 }[energy];
}

export function blockerLabel(blocker: BlockerId) {
  return {
    cannotDecide: "I cannot decide what to do",
    cannotStart: "I know what to do but cannot start",
    tooBig: "The task feels too big",
    overwhelmed: "I feel overwhelmed",
    distracted: "I keep getting distracted",
    cannotRemember: "I cannot remember the steps",
    doNotUnderstand: "I do not understand the task",
    worriedBadly: "I am worried about doing it badly",
    veryLowEnergy: "I have almost no energy",
    somethingElse: "Something else"
  }[blocker];
}
