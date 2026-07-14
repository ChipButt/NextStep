import type {
  ExcludedTask,
  LoadLevel,
  ScoreBreakdown,
  SelectionContext,
  SelectionDebug,
  Task,
  TaskScore
} from "./types";

const urgencyScores = { 1: 5, 2: 15, 3: 30 };
const importanceScores = { 1: 5, 2: 10, 3: 20 };
const emotionalPenalties: Record<LoadLevel, number> = { low: 0, medium: -5, high: -15 };
const energyValues = { veryLow: 0, low: 1, medium: 2, high: 3 };
const taskEnergyValues: Record<LoadLevel, number> = { low: 0, medium: 2, high: 3 };

export function selectTask(tasks: Task[], context: SelectionContext): { task?: Task; debug: SelectionDebug } {
  const excludedTasks: ExcludedTask[] = [];
  const scores: TaskScore[] = [];

  for (const task of tasks) {
    const exclusion = getTemporaryExclusion(task, tasks, context);
    if (exclusion) {
      excludedTasks.push({ taskId: task.id, title: task.title, reason: exclusion });
      continue;
    }
    const breakdown = scoreTask(task, context);
    scores.push({ taskId: task.id, title: task.title, score: breakdown.total, breakdown });
  }

  const ranked = [...scores].sort((a, b) => compareTaskScores(a, b, tasks));
  const selected = ranked[0] ? tasks.find((task) => task.id === ranked[0].taskId) : undefined;

  return {
    task: selected,
    debug: {
      eligibleTasks: scores.map((score) => score.taskId),
      excludedTasks,
      scores,
      selectedTaskId: selected?.id
    }
  };
}

export function getTemporaryExclusion(task: Task, allTasks: Task[], context: SelectionContext): string | null {
  if (task.status === "completed") return "already completed";
  if (task.status === "abandoned") return "abandoned";
  if (context.pausedTaskIds.includes(task.id)) return "paused during this session";
  if ((context.rejectedTaskCounts[task.id] ?? 0) >= 2) return "rejected twice in this session";

  if (task.blockedBy) {
    const blocker = allTasks.find((candidate) => candidate.id === task.blockedBy);
    if (blocker && blocker.status !== "completed") return `blocked by ${blocker.title}`;
  }

  if (task.location && context.currentLocation && task.location !== context.currentLocation) {
    return `requires ${task.location}`;
  }

  if (task.requiredItems?.length && context.availableItems?.length) {
    const missing = task.requiredItems.find((item) => !context.availableItems?.includes(item));
    if (missing) return `missing ${missing}`;
  }

  const energyGap = taskEnergyValues[task.energyRequired] - energyValues[context.energy];
  if (energyGap > 1) return "requires substantially more energy";

  return null;
}

export function scoreTask(task: Task, context: SelectionContext): ScoreBreakdown {
  const urgencyScore = urgencyScores[task.urgency];
  const importanceScore = importanceScores[task.importance];
  const deadlineScore = getDeadlineScore(task.deadline, context.now);
  const timeFitScore = getTimeFitScore(task, context.availableMinutes);
  const energyFitScore = getEnergyFitScore(task.energyRequired, context.energy);
  const momentumScore = getMomentumScore(task);
  const emotionalResistancePenalty = emotionalPenalties[task.emotionalLoad];
  const recentlyRejectedPenalty = (context.rejectedTaskCounts[task.id] ?? 0) * -20;
  const veryLowEnergyAdjustment =
    context.energy === "veryLow" ? getVeryLowEnergyAdjustment(task) : 0;

  const total =
    urgencyScore +
    importanceScore +
    deadlineScore +
    timeFitScore +
    energyFitScore +
    momentumScore +
    emotionalResistancePenalty +
    recentlyRejectedPenalty +
    veryLowEnergyAdjustment;

  return {
    urgencyScore,
    importanceScore,
    deadlineScore,
    timeFitScore,
    energyFitScore,
    momentumScore,
    emotionalResistancePenalty,
    recentlyRejectedPenalty,
    veryLowEnergyAdjustment,
    total
  };
}

export function getDeadlineScore(deadline: string | undefined, now: Date) {
  if (!deadline) return 0;
  const days = daysUntil(deadline, now);
  if (days === null) return 0;
  if (days < 0) return 40;
  if (days === 0) return 35;
  if (days === 1) return 25;
  if (days <= 3) return 15;
  if (days <= 7) return 8;
  return 0;
}

export function daysUntil(deadline: string, now: Date) {
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function getTimeFitScore(task: Task, availableMinutes: number) {
  if (task.estimatedMinutes <= availableMinutes * 0.5) return 20;
  if (task.estimatedMinutes <= availableMinutes) return 15;
  if (hasDefinedProgress(task)) return 5;
  return -30;
}

function getEnergyFitScore(load: LoadLevel, energy: SelectionContext["energy"]) {
  const taskValue = taskEnergyValues[load];
  const userValue = energyValues[energy];
  if (taskValue < userValue) return 15;
  if (taskValue === userValue) return 20;
  if (taskValue - userValue === 1) return -10;
  return -30;
}

function getMomentumScore(task: Task) {
  const alreadyStarted = task.status === "active" || task.steps.some((step) => step.completed);
  const hasNextStep = task.steps.some((step) => !step.completed);
  return (alreadyStarted ? 10 : 0) + (hasNextStep ? 10 : 0);
}

function getVeryLowEnergyAdjustment(task: Task) {
  const lowLoadCount = [task.cognitiveLoad, task.emotionalLoad, task.physicalLoad].filter(
    (load) => load === "low"
  ).length;
  const dependencyPenalty = task.blockedBy || task.requiredItems?.length ? -10 : 0;
  const shortBonus = task.estimatedMinutes <= 5 ? 15 : task.estimatedMinutes <= 15 ? 5 : -10;
  return lowLoadCount * 5 + shortBonus + dependencyPenalty;
}

function hasDefinedProgress(task: Task) {
  return task.steps.length > 0 || task.estimatedMinutes <= 30;
}

function compareTaskScores(a: TaskScore, b: TaskScore, tasks: Task[]) {
  if (b.score !== a.score) return b.score - a.score;
  const taskA = tasks.find((task) => task.id === a.taskId);
  const taskB = tasks.find((task) => task.id === b.taskId);
  if (!taskA || !taskB) return 0;

  const deadlineA = taskA.deadline ? new Date(taskA.deadline).getTime() : Number.POSITIVE_INFINITY;
  const deadlineB = taskB.deadline ? new Date(taskB.deadline).getTime() : Number.POSITIVE_INFINITY;
  if (deadlineA !== deadlineB) return deadlineA - deadlineB;
  if (taskA.estimatedMinutes !== taskB.estimatedMinutes) {
    return taskA.estimatedMinutes - taskB.estimatedMinutes;
  }
  return new Date(taskA.createdAt).getTime() - new Date(taskB.createdAt).getTime();
}
