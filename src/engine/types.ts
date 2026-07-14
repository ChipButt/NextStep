export type TaskStatus = "inbox" | "active" | "paused" | "completed" | "abandoned";
export type PriorityLevel = 1 | 2 | 3;
export type EstimateMinutes = 5 | 10 | 15 | 30 | 45 | 60 | 90 | 120;
export type LoadLevel = "low" | "medium" | "high";
export type EnergyLevel = "veryLow" | "low" | "medium" | "high";
export type UrgencyAnswer = "yes" | "no" | "unsure";
export type TaskCategory =
  | "communication"
  | "cleaning"
  | "administrative"
  | "creative"
  | "research"
  | "phone"
  | "leaving"
  | "generic";

export type TaskStep = {
  id: string;
  text: string;
  completed: boolean;
  order: number;
};

export type Task = {
  id: string;
  title: string;
  description?: string;

  status: TaskStatus;

  importance: PriorityLevel;
  urgency: PriorityLevel;

  deadline?: string;

  estimatedMinutes: EstimateMinutes;

  energyRequired: LoadLevel;

  cognitiveLoad: LoadLevel;
  emotionalLoad: LoadLevel;
  physicalLoad: LoadLevel;

  location?: string;
  requiredItems?: string[];

  blockedBy?: string;
  parentTaskId?: string;

  steps: TaskStep[];

  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type BlockerId =
  | "cannotDecide"
  | "cannotStart"
  | "tooBig"
  | "overwhelmed"
  | "distracted"
  | "cannotRemember"
  | "doNotUnderstand"
  | "worriedBadly"
  | "veryLowEnergy"
  | "somethingElse";

export type StuckReason =
  | "stillCannotStart"
  | "doNotUnderstand"
  | "tooBig"
  | "missingNeed"
  | "distracted"
  | "overwhelmed"
  | "afraidWrong"
  | "ranOutEnergy"
  | "discoveredTask"
  | "somethingElse";

export type SessionState =
  | "WELCOME"
  | "URGENT_CHECK"
  | "URGENT_CLARIFICATION"
  | "TIME_CHECK"
  | "ENERGY_CHECK"
  | "BLOCKER_CHECK"
  | "TASK_SELECTION"
  | "TASK_CONFIRMATION"
  | "TASK_DECOMPOSITION"
  | "ACTION_READY"
  | "ACTION_ACTIVE"
  | "STUCK_REASON"
  | "STUCK_INTERVENTION"
  | "ACTION_COMPLETE"
  | "TASK_COMPLETION_CHECK"
  | "TASK_COMPLETE"
  | "TASK_PAUSED"
  | "SESSION_COMPLETE";

export type SessionInputs = {
  immediateUrgency?: UrgencyAnswer;
  urgentClarification?: boolean;
  availableMinutes?: number;
  energy?: EnergyLevel;
  initialBlocker?: BlockerId;
  initialBlockerText?: string;
  currentLocation?: string;
  availableItems?: string[];
};

export type ScoreBreakdown = {
  urgencyScore: number;
  importanceScore: number;
  deadlineScore: number;
  timeFitScore: number;
  energyFitScore: number;
  momentumScore: number;
  emotionalResistancePenalty: number;
  recentlyRejectedPenalty: number;
  veryLowEnergyAdjustment: number;
  total: number;
};

export type TaskScore = {
  taskId: string;
  title: string;
  score: number;
  breakdown: ScoreBreakdown;
};

export type ExcludedTask = {
  taskId: string;
  title: string;
  reason: string;
};

export type SelectionDebug = {
  eligibleTasks: string[];
  excludedTasks: ExcludedTask[];
  scores: TaskScore[];
  selectedTaskId?: string;
};

export type SelectionContext = {
  availableMinutes: number;
  energy: EnergyLevel;
  initialBlocker?: BlockerId;
  now: Date;
  currentLocation?: string;
  availableItems?: string[];
  rejectedTaskCounts: Record<string, number>;
  pausedTaskIds: string[];
};

export type SessionRecord = {
  id: string;
  taskId: string;
  taskTitle: string;
  startedAt: string;
  endedAt: string;
  statedEnergy?: EnergyLevel;
  availableTime?: number;
  initialBlocker?: BlockerId;
  actionsCompleted: string[];
  interventionsUsed: string[];
  result: "completed" | "paused" | "abandoned";
  durationSeconds: number;
};

export type Session = {
  id: string;
  state: SessionState;
  inputs: SessionInputs;
  selectedTaskId?: string;
  currentStepId?: string;
  currentAction?: string;
  currentActionNote?: string;
  rejectedTaskCounts: Record<string, number>;
  pausedTaskIds: string[];
  interventionsUsed: string[];
  actionsCompleted: string[];
  stateHistory: SessionState[];
  startedAt: string;
  updatedAt: string;
  startLadderIndex?: number;
  actionTimerStartedAt?: string;
  actionTimerEndsAt?: string;
  actionTimerExpiredAt?: string;
  actionTimerNotificationSentAt?: string;
  lastStuckReason?: StuckReason;
  lastSelection?: SelectionDebug;
  pauseNote?: string;
  missingItem?: string;
  completionReflection?: boolean;
};

export type Settings = {
  textSize: "normal" | "large" | "extraLarge";
  highContrast: boolean;
  reducedMotion: boolean;
  sound: boolean;
  voiceMode: boolean;
  spokenPrompts: boolean;
  actionNotifications: boolean;
  defaultTimerSeconds: number;
  showAcknowledgements: boolean;
  debugMode: boolean;
  firstLaunchDemoSeen: boolean;
};

export type AppData = {
  version: 1;
  tasks: Task[];
  history: SessionRecord[];
  settings: Settings;
  activeSession?: Session;
};

export type SessionEvent =
  | { type: "START" }
  | { type: "URGENT_CHECK"; answer: UrgencyAnswer }
  | { type: "URGENT_TASK"; taskId?: string; title?: string }
  | { type: "URGENT_CLARIFICATION"; urgent: boolean }
  | { type: "TIME_SELECTED"; minutes: number }
  | { type: "ENERGY_SELECTED"; energy: EnergyLevel }
  | { type: "BLOCKER_SELECTED"; blocker: BlockerId; text?: string }
  | { type: "CONFIRM_TASK"; action: "begin" | "cannot" | "chooseElse"; reason?: string }
  | { type: "REJECT_SELECTED"; reason: string }
  | { type: "DONE_ACTION" }
  | { type: "TASK_COMPLETION"; answer: "yes" | "almost" | "unsure"; remainingText?: string }
  | { type: "STUCK" }
  | { type: "STUCK_REASON"; reason: StuckReason; details?: string; missingType?: string }
  | { type: "RESUME_ACTION" }
  | { type: "ACTION_TIMER_STARTED"; startedAt: string; endsAt: string }
  | { type: "ACTION_TIMER_EXPIRED"; expiredAt: string }
  | { type: "ACTION_TIMER_NOTIFICATION_SENT"; sentAt: string }
  | { type: "PAUSE"; note?: string }
  | { type: "CAPTURE_DISCOVERED"; title: string; urgent?: boolean }
  | { type: "RESUME_PAUSED"; taskId: string };

export type TransitionResult = {
  session: Session;
  tasks: Task[];
  historyRecord?: SessionRecord;
};
