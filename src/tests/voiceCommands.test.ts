import { describe, expect, it } from "vitest";
import { createSession } from "../engine/decisionEngine";
import { createTask } from "../engine/taskFactory";
import { parseVoiceCommand } from "../voice/voiceCommands";

describe("voice command parser", () => {
  it("adds a rough task from speech", () => {
    const command = parseVoiceCommand("add task reply to Sarah", {
      view: "start",
      tasks: []
    });

    expect(command).toEqual({ type: "ADD_TASK", title: "Reply to sarah" });
  });

  it("answers a session question by voice", () => {
    const command = parseVoiceCommand("not sure", {
      view: "start",
      tasks: [],
      session: { ...createSession(), state: "URGENT_CHECK" }
    });

    expect(command).toEqual({ type: "SESSION_EVENT", event: { type: "URGENT_CHECK", answer: "unsure" } });
  });

  it("marks the active action done", () => {
    const task = createTask({ title: "Reply to the venue email" });
    const command = parseVoiceCommand("done", {
      view: "start",
      tasks: [task],
      session: {
        ...createSession(),
        state: "ACTION_READY",
        selectedTaskId: task.id,
        currentAction: "Open the relevant app."
      }
    });

    expect(command).toEqual({ type: "SESSION_EVENT", event: { type: "DONE_ACTION" } });
  });

  it("captures a discovered task without changing wording into a dashboard action", () => {
    const task = createTask({ title: "Reply to the venue email" });
    const command = parseVoiceCommand("I discovered another task buy stamps", {
      view: "start",
      tasks: [task],
      session: {
        ...createSession(),
        state: "STUCK_REASON",
        selectedTaskId: task.id,
        currentAction: "Open the relevant app."
      }
    });

    expect(command).toEqual({
      type: "SESSION_EVENT",
      event: { type: "CAPTURE_DISCOVERED", title: "Buy stamps", urgent: false }
    });
  });
});
