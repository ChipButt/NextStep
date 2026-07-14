import { createTask } from "../engine/taskFactory";
import type { Task } from "../engine/types";

function dateOffset(days: number, base = new Date()) {
  const date = new Date(base);
  date.setDate(base.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createSampleTasks(now = new Date()): Task[] {
  const base = new Date(now);
  base.setHours(9, 0, 0, 0);

  return [
    createTask(
      {
        title: "Reply to the venue email",
        urgency: 3,
        importance: 3,
        deadline: dateOffset(0, base),
        estimatedMinutes: 15,
        energyRequired: "medium",
        cognitiveLoad: "medium",
        emotionalLoad: "high",
        physicalLoad: "low"
      },
      new Date(base.getTime() - 10 * 86_400_000)
    ),
    createTask(
      {
        title: "Put a load of washing on",
        urgency: 2,
        importance: 2,
        estimatedMinutes: 30,
        energyRequired: "low",
        cognitiveLoad: "low",
        emotionalLoad: "low",
        physicalLoad: "medium"
      },
      new Date(base.getTime() - 9 * 86_400_000)
    ),
    createTask(
      {
        title: "Complete the job application",
        urgency: 3,
        importance: 3,
        deadline: dateOffset(1, base),
        estimatedMinutes: 90,
        energyRequired: "high",
        cognitiveLoad: "high",
        emotionalLoad: "high",
        physicalLoad: "low"
      },
      new Date(base.getTime() - 8 * 86_400_000)
    ),
    createTask(
      {
        title: "Take the bins outside",
        urgency: 2,
        importance: 2,
        deadline: dateOffset(0, base),
        estimatedMinutes: 5,
        energyRequired: "low",
        cognitiveLoad: "low",
        emotionalLoad: "low",
        physicalLoad: "medium"
      },
      new Date(base.getTime() - 7 * 86_400_000)
    ),
    createTask(
      {
        title: "Book a dentist appointment",
        urgency: 2,
        importance: 3,
        deadline: dateOffset(3, base),
        estimatedMinutes: 15,
        energyRequired: "medium",
        cognitiveLoad: "medium",
        emotionalLoad: "medium",
        physicalLoad: "low"
      },
      new Date(base.getTime() - 6 * 86_400_000)
    ),
    createTask(
      {
        title: "Organise receipts for the month",
        urgency: 1,
        importance: 2,
        deadline: dateOffset(7, base),
        estimatedMinutes: 45,
        energyRequired: "medium",
        cognitiveLoad: "medium",
        emotionalLoad: "low",
        physicalLoad: "low"
      },
      new Date(base.getTime() - 5 * 86_400_000)
    ),
    createTask(
      {
        title: "Edit the first five minutes of the video",
        urgency: 2,
        importance: 2,
        deadline: dateOffset(2, base),
        estimatedMinutes: 60,
        energyRequired: "high",
        cognitiveLoad: "high",
        emotionalLoad: "medium",
        physicalLoad: "low"
      },
      new Date(base.getTime() - 4 * 86_400_000)
    ),
    createTask(
      {
        title: "Buy dog food",
        urgency: 3,
        importance: 2,
        deadline: dateOffset(0, base),
        estimatedMinutes: 30,
        energyRequired: "medium",
        cognitiveLoad: "low",
        emotionalLoad: "low",
        physicalLoad: "medium"
      },
      new Date(base.getTime() - 3 * 86_400_000)
    ),
    createTask(
      {
        title: "Charge the camera batteries",
        urgency: 1,
        importance: 2,
        deadline: dateOffset(3, base),
        estimatedMinutes: 5,
        energyRequired: "low",
        cognitiveLoad: "low",
        emotionalLoad: "low",
        physicalLoad: "low"
      },
      new Date(base.getTime() - 2 * 86_400_000)
    ),
    createTask(
      {
        title: "Clean the kitchen",
        urgency: 2,
        importance: 2,
        estimatedMinutes: 60,
        energyRequired: "medium",
        cognitiveLoad: "low",
        emotionalLoad: "medium",
        physicalLoad: "high"
      },
      new Date(base.getTime() - 86_400_000)
    )
  ];
}
