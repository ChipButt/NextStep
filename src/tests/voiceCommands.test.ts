import { describe, expect, it } from "vitest";
import { createSession } from "../engine/decisionEngine";
import { createTask } from "../engine/taskFactory";
import { getVoicePrompt, parseVoiceCommand } from "../voice/voiceCommands";

describe("voice command parser", () => {
  it("adds a rough task from speech", () => {
    const command = parseVoiceCommand("add task reply to Sarah", {
      view: "start",
      tasks: []
    });

    expect(command).toEqual({ type: "ADD_TASK", title: "Reply to sarah" });
  });

  it("adds a task from conversational task-list speech", () => {
    const command = parseVoiceCommand("can you add pay the council tax to my task list", {
      view: "start",
      tasks: []
    });

    expect(command).toEqual({ type: "ADD_TASK", title: "Pay the council tax" });
  });

  it("adds a task from a need statement on the start screen", () => {
    const command = parseVoiceCommand("I need to put a load of washing on", {
      view: "start",
      tasks: []
    });

    expect(command).toEqual({ type: "ADD_TASK", title: "Put a load of washing on" });
  });

  it("treats a bare start-screen phrase as a task", () => {
    const command = parseVoiceCommand("book dentist appointment", {
      view: "start",
      tasks: []
    });

    expect(command).toEqual({ type: "ADD_TASK", title: "Book dentist appointment" });
  });

  it("can create a task and start the help flow from one phrase", () => {
    const command = parseVoiceCommand("help me start with cleaning the kitchen", {
      view: "start",
      tasks: []
    });

    expect(command).toEqual({ type: "ADD_TASK", title: "Cleaning the kitchen", start: true });
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

  it("keeps the stuck reason voice prompt short", () => {
    const task = createTask({ title: "Reply to the venue email" });
    const prompt = getVoicePrompt({
      view: "start",
      tasks: [task],
      session: {
        ...createSession(),
        state: "STUCK_REASON",
        selectedTaskId: task.id,
        currentAction: "Open the relevant app."
      }
    });

    expect(prompt).toBe("What stopped you?");
  });

  it("keeps spoken session prompts to the question instead of reading all options", () => {
    const task = createTask({ title: "Reply to the venue email" });
    const states = [
      "URGENT_CHECK",
      "TIME_CHECK",
      "ENERGY_CHECK",
      "BLOCKER_CHECK",
      "TASK_COMPLETION_CHECK"
    ] as const;

    const prompts = states.map((state) =>
      getVoicePrompt({
        view: "start",
        tasks: [task],
        session: {
          ...createSession(),
          state,
          selectedTaskId: task.id
        }
      })
    );

    expect(prompts).toEqual([
      "Is there anything urgent or unsafe that must be handled now?",
      "How much usable time do you have?",
      "How much energy do you have?",
      "What is the main problem right now?",
      "Is the task actually finished?"
    ]);
    expect(prompts.join(" ")).not.toMatch(/\bSay\b|You can say|yes, no|very low, low|cannot decide/);
  });
});
