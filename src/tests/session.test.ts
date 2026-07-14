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
});
