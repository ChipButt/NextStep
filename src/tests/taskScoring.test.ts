import { describe, expect, it } from "vitest";
import { createTask } from "../engine/taskFactory";
import { selectTask } from "../engine/taskScoring";
import type { SelectionContext, Task } from "../engine/types";

const now = new Date("2026-07-14T12:00:00.000Z");

function context(overrides: Partial<SelectionContext> = {}): SelectionContext {
  return {
    availableMinutes: 30,
    energy: "medium",
    now,
    rejectedTaskCounts: {},
    pausedTaskIds: [],
    ...overrides
  };
}

type TaskOverride = Partial<Omit<Task, "steps">> & { steps?: string[] };

function task(title: string, overrides: TaskOverride = {}) {
  return createTask(
    {
      title,
      importance: 2,
      urgency: 2,
      estimatedMinutes: 15,
      energyRequired: "medium",
      cognitiveLoad: "medium",
      emotionalLoad: "low",
      physicalLoad: "low",
      steps: ["Open the relevant thing."],
      ...overrides
    },
    new Date("2026-07-01T09:00:00.000Z")
  );
}

describe("task selection scoring", () => {
  it("selects an overdue urgent task over a nonurgent task", () => {
    const urgent = task("Pay overdue bill", {
      urgency: 3,
      importance: 3,
      deadline: "2026-07-13"
    });
    const nonurgent = task("File notes", { urgency: 1, importance: 1 });

    expect(selectTask([nonurgent, urgent], context()).task?.id).toBe(urgent.id);
  });

  it("prefers a five-minute task when only five minutes are available", () => {
    const tiny = task("Take bins outside", { estimatedMinutes: 5 });
    const longer = task("Clean kitchen", { estimatedMinutes: 30 });

    expect(selectTask([longer, tiny], context({ availableMinutes: 5 })).task?.id).toBe(tiny.id);
  });

  it("does not select a high-energy task during very-low-energy mode when a low-energy alternative exists", () => {
    const highEnergy = task("Complete application", {
      urgency: 3,
      importance: 3,
      energyRequired: "high",
      cognitiveLoad: "high",
      emotionalLoad: "high"
    });
    const lowEnergy = task("Charge batteries", {
      urgency: 1,
      importance: 2,
      estimatedMinutes: 5,
      energyRequired: "low",
      cognitiveLoad: "low",
      emotionalLoad: "low",
      physicalLoad: "low"
    });

    expect(selectTask([highEnergy, lowEnergy], context({ energy: "veryLow" })).task?.id).toBe(
      lowEnergy.id
    );
  });

  it("does not select a blocked task", () => {
    const prerequisite = task("Find password", { status: "inbox" });
    const blocked = task("Submit form", { blockedBy: prerequisite.id, urgency: 3 });
    const available = task("Reply to email");

    const result = selectTask([blocked, prerequisite, available], context());

    expect(result.debug.excludedTasks.find((item) => item.taskId === blocked.id)?.reason).toContain(
      "blocked by"
    );
    expect(result.task?.id).not.toBe(blocked.id);
  });

  it("penalizes a rejected task", () => {
    const rejected = task("First equal task", { deadline: "2026-07-20" });
    const fresh = task("Second equal task", { deadline: "2026-07-20" });

    expect(
      selectTask(
        [rejected, fresh],
        context({ rejectedTaskCounts: { [rejected.id]: 1 } })
      ).task?.id
    ).toBe(fresh.id);
  });

  it("removes a task rejected twice in the current session", () => {
    const rejected = task("Rejected twice");
    const available = task("Available");

    const result = selectTask(
      [rejected, available],
      context({ rejectedTaskCounts: { [rejected.id]: 2 } })
    );

    expect(result.debug.excludedTasks.find((item) => item.taskId === rejected.id)?.reason).toBe(
      "rejected twice in this session"
    );
    expect(result.task?.id).toBe(available.id);
  });

  it("prioritizes a task with a deadline today appropriately", () => {
    const today = task("Due today", { deadline: "2026-07-14", urgency: 2 });
    const later = task("Due next week", { deadline: "2026-07-21", urgency: 2 });

    expect(selectTask([later, today], context()).task?.id).toBe(today.id);
  });

  it("is deterministic for identical task and session data", () => {
    const tasks = [
      task("Alpha", { deadline: "2026-07-20" }),
      task("Beta", { deadline: "2026-07-20", estimatedMinutes: 10 })
    ];

    const first = selectTask(tasks, context()).task?.id;
    const second = selectTask(tasks, context()).task?.id;

    expect(second).toBe(first);
  });
});
