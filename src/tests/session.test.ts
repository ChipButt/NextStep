import { describe, expect, it } from "vitest";
import { createSession, transition } from "../engine/decisionEngine";
import { createTask } from "../engine/taskFactory";

describe("session state machine", () => {
  it("restores a paused session to the correct current step", () => {
    const task = createTask({
      title: "Complete form",
      status: "paused",
      steps: ["Open the form.", "Fill in one field."]
    });
    const taskWithProgress = {
      ...task,
      steps: task.steps.map((step, index) => (index === 0 ? { ...step, completed: true } : step))
    };
    const session = createSession(new Date("2026-07-14T09:00:00Z"));

    const result = transition(session, [taskWithProgress], { type: "RESUME_PAUSED", taskId: task.id });

    expect(result.session.currentAction).toBe("Fill in one field.");
    expect(result.session.currentActionNote).toBe("You stopped here:");
    expect(result.tasks[0].status).toBe("active");
  });

  it("captures a newly discovered nonurgent task without replacing the active task", () => {
    const active = createTask({ title: "Reply to venue email" });
    const session = {
      ...createSession(),
      state: "ACTION_READY" as const,
      selectedTaskId: active.id,
      currentAction: "Open the relevant app."
    };

    const result = transition(session, [active], {
      type: "CAPTURE_DISCOVERED",
      title: "Buy stamps",
      urgent: false
    });

    expect(result.tasks).toHaveLength(2);
    expect(result.session.selectedTaskId).toBe(active.id);
    expect(result.session.state).toBe("ACTION_READY");
  });

  it("allows an urgent newly discovered task to interrupt the active task", () => {
    const active = createTask({ title: "Reply to venue email" });
    const session = {
      ...createSession(),
      state: "ACTION_READY" as const,
      selectedTaskId: active.id,
      currentAction: "Open the relevant app."
    };

    const result = transition(session, [active], {
      type: "CAPTURE_DISCOVERED",
      title: "Send document due today",
      urgent: true
    });

    expect(result.tasks).toHaveLength(2);
    expect(result.session.selectedTaskId).toBe(result.tasks[1].id);
    expect(result.session.state).toBe("TASK_CONFIRMATION");
  });

  it("stores an action timer end time and clears it when moving to the next action", () => {
    const task = createTask({
      title: "Complete form",
      steps: ["Open the form.", "Fill in one field."]
    });
    const session = {
      ...createSession(new Date("2026-07-14T09:00:00Z")),
      state: "ACTION_READY" as const,
      selectedTaskId: task.id,
      currentStepId: task.steps[0].id,
      currentAction: task.steps[0].text
    };

    const withTimer = transition(
      session,
      [task],
      {
        type: "ACTION_TIMER_STARTED",
        startedAt: "2026-07-14T09:00:00.000Z",
        endsAt: "2026-07-14T09:10:00.000Z"
      },
      new Date("2026-07-14T09:00:00Z")
    );
    const advanced = transition(withTimer.session, withTimer.tasks, { type: "DONE_ACTION" });

    expect(withTimer.session.actionTimerEndsAt).toBe("2026-07-14T09:10:00.000Z");
    expect(advanced.session.currentAction).toBe("Fill in one field.");
    expect(advanced.session.actionTimerEndsAt).toBeUndefined();
  });

  it("keeps a running action timer through stuck support and blocks early pause", () => {
    const task = createTask({ title: "Complete form" });
    const session = {
      ...createSession(new Date("2026-07-14T09:00:00Z")),
      state: "ACTION_READY" as const,
      selectedTaskId: task.id,
      currentAction: "Open the form.",
      actionTimerStartedAt: "2026-07-14T09:00:00.000Z",
      actionTimerEndsAt: "2026-07-14T09:10:00.000Z"
    };

    const stuck = transition(session, [task], { type: "STUCK_REASON", reason: "stillCannotStart" }, new Date("2026-07-14T09:02:00Z"));
    const paused = transition(stuck.session, stuck.tasks, { type: "PAUSE", note: "too soon" }, new Date("2026-07-14T09:03:00Z"));

    expect(stuck.session.actionTimerEndsAt).toBe("2026-07-14T09:10:00.000Z");
    expect(paused.session.state).toBe("STUCK_INTERVENTION");
    expect(paused.historyRecord).toBeUndefined();
  });

  it("allows pause after the action timer deadline has passed", () => {
    const task = createTask({ title: "Complete form" });
    const session = {
      ...createSession(new Date("2026-07-14T09:00:00Z")),
      state: "ACTION_READY" as const,
      selectedTaskId: task.id,
      currentAction: "Open the form.",
      actionTimerStartedAt: "2026-07-14T09:00:00.000Z",
      actionTimerEndsAt: "2026-07-14T09:10:00.000Z"
    };

    const paused = transition(session, [task], { type: "PAUSE", note: "time elapsed" }, new Date("2026-07-14T09:11:00Z"));

    expect(paused.session.state).toBe("TASK_PAUSED");
    expect(paused.historyRecord?.result).toBe("paused");
  });
});
