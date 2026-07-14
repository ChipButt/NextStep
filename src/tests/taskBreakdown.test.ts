import { describe, expect, it } from "vitest";
import { createMissingPrerequisite } from "../engine/blockerResponses";
import { splitMeaningfulActions, validateAction } from "../engine/taskBreakdown";
import { createTask } from "../engine/taskFactory";

describe("task breakdown and blocker responses", () => {
  it("creates a prerequisite task when an item is missing", () => {
    const task = createTask({ title: "Submit application", urgency: 3, importance: 3 });
    const result = createMissingPrerequisite(task, "passport number");

    expect(result.prerequisite.title).toContain("passport number");
    expect(result.blockedTask.blockedBy).toBe(result.prerequisite.id);
    expect(result.blockedTask.status).toBe("paused");
  });

  it("rejects a vague action", () => {
    expect(validateAction("Get organised").valid).toBe(false);
    expect(validateAction("Get organised").reason).toBe("vague");
  });

  it("splits an action containing multiple meaningful actions", () => {
    const validation = validateAction("Open the email and write a reply.");

    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe("multiple-actions");
    expect(splitMeaningfulActions("Open the email and write a reply.")).toEqual([
      "Open the email.",
      "write a reply."
    ]);
  });
});
