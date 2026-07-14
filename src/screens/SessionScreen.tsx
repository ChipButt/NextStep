import { useMemo, useState, type ReactNode } from "react";
import { DoorOpen, Pause, Volume2 } from "lucide-react";
import { Button } from "../components/Button";
import { Choice, ChoiceGroup } from "../components/ChoiceGroup";
import { ScreenShell } from "../components/ScreenShell";
import { TimerControl } from "../components/TimerControl";
import type { BlockerId, EnergyLevel, Session, SessionEvent, Settings, StuckReason, Task } from "../engine/types";

type SessionScreenProps = {
  session: Session;
  tasks: Task[];
  settings: Settings;
  onEvent: (event: SessionEvent) => void;
  onStartAgain: () => void;
  onExit: () => void;
};

const timeChoices: Choice<number>[] = [
  { label: "About 5 minutes", value: 5 },
  { label: "About 15 minutes", value: 15 },
  { label: "About 30 minutes", value: 30 },
  { label: "About an hour", value: 60 },
  { label: "More than an hour", value: 120 },
  { label: "I do not know", value: 15 }
];

const energyChoices: Choice<EnergyLevel>[] = [
  { label: "Very low", value: "veryLow" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" }
];

const blockerChoices: Choice<BlockerId>[] = [
  { label: "I cannot decide what to do", value: "cannotDecide" },
  { label: "I know what to do but cannot start", value: "cannotStart" },
  { label: "The task feels too big", value: "tooBig" },
  { label: "I feel overwhelmed", value: "overwhelmed" },
  { label: "I keep getting distracted", value: "distracted" },
  { label: "I cannot remember the steps", value: "cannotRemember" },
  { label: "I do not understand the task", value: "doNotUnderstand" },
  { label: "I am worried about doing it badly", value: "worriedBadly" },
  { label: "I have almost no energy", value: "veryLowEnergy" },
  { label: "Something else", value: "somethingElse" }
];

const stuckChoices: Choice<StuckReason>[] = [
  { label: "I still cannot start", value: "stillCannotStart" },
  { label: "I do not understand the action", value: "doNotUnderstand" },
  { label: "The action is too big", value: "tooBig" },
  { label: "I do not have what I need", value: "missingNeed" },
  { label: "I got distracted", value: "distracted" },
  { label: "I feel overwhelmed", value: "overwhelmed" },
  { label: "I am afraid of doing it wrong", value: "afraidWrong" },
  { label: "I ran out of energy", value: "ranOutEnergy" },
  { label: "I discovered another task", value: "discoveredTask" },
  { label: "Something else", value: "somethingElse" }
];

const rejectReasons: Choice<string>[] = [
  { label: "I do not have what I need", value: "need" },
  { label: "I am in the wrong place", value: "place" },
  { label: "It needs more time", value: "time" },
  { label: "It needs more energy", value: "energy" },
  { label: "It feels too difficult", value: "difficult" },
  { label: "It feels too stressful", value: "stressful" },
  { label: "It is not actually important", value: "importance" },
  { label: "Other", value: "other" }
];

export function SessionScreen({ session, tasks, settings, onEvent, onStartAgain, onExit }: SessionScreenProps) {
  const selectedTask = tasks.find((task) => task.id === session.selectedTaskId);
  const timerLocked = hasRunningActionTimer(session);
  const [urgentTitle, setUrgentTitle] = useState("");
  const [blockerText, setBlockerText] = useState("");
  const [rejectPrompt, setRejectPrompt] = useState(false);
  const [pausePrompt, setPausePrompt] = useState(false);
  const [pauseNote, setPauseNote] = useState("");
  const [missingText, setMissingText] = useState("");
  const [discoveredTitle, setDiscoveredTitle] = useState("");
  const [discoveredUrgent, setDiscoveredUrgent] = useState(false);
  const [pendingStuck, setPendingStuck] = useState<StuckReason | null>(null);
  const [remainingText, setRemainingText] = useState("");

  const visibleTasks = useMemo(
    () => tasks.filter((task) => task.status !== "completed" && task.status !== "abandoned").slice(0, 5),
    [tasks]
  );

  if (session.state === "URGENT_CHECK") {
    return (
      <Question
        question="Is there anything that could cause immediate harm, serious financial loss or a missed deadline today if it is not handled now?"
        onExit={onExit}
      >
        <ChoiceGroup
          choices={[
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
            { label: "I am not sure", value: "unsure" }
          ]}
          onChoose={(answer) => onEvent({ type: "URGENT_CHECK", answer: answer as "yes" | "no" | "unsure" })}
        />
      </Question>
    );
  }

  if (session.state === "URGENT_CLARIFICATION" && session.inputs.immediateUrgency === "yes") {
    return (
      <Question question="Which task is it?" onExit={onExit}>
        <div className="field-stack">
          <input value={urgentTitle} onChange={(event) => setUrgentTitle(event.target.value)} placeholder="Enter the urgent task" />
          <Button
            variant="primary"
            disabled={!urgentTitle.trim()}
            onClick={() => onEvent({ type: "URGENT_TASK", title: urgentTitle })}
          >
            Use this task
          </Button>
        </div>
        {visibleTasks.length ? (
          <ChoiceGroup
            choices={visibleTasks.map((task) => ({ label: task.title, value: task.id }))}
            onChoose={(taskId) => onEvent({ type: "URGENT_TASK", taskId })}
          />
        ) : null}
      </Question>
    );
  }

  if (session.state === "URGENT_CLARIFICATION") {
    return (
      <Question question="Is anything due today, already overdue, unsafe, or stopping another person from continuing?" onExit={onExit}>
        <ChoiceGroup
          choices={[
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" }
          ]}
          onChoose={(value) => onEvent({ type: "URGENT_CLARIFICATION", urgent: value === "yes" })}
        />
      </Question>
    );
  }

  if (session.state === "TIME_CHECK") {
    return (
      <Question question="How much usable time do you have right now?" onExit={onExit}>
        <ChoiceGroup choices={timeChoices} onChoose={(minutes) => onEvent({ type: "TIME_SELECTED", minutes })} />
      </Question>
    );
  }

  if (session.state === "ENERGY_CHECK") {
    return (
      <Question question="How much energy do you have right now?" onExit={onExit}>
        <ChoiceGroup choices={energyChoices} onChoose={(energy) => onEvent({ type: "ENERGY_SELECTED", energy })} />
      </Question>
    );
  }

  if (session.state === "BLOCKER_CHECK") {
    const chooseBlocker = (blocker: BlockerId) => {
      if (blocker === "somethingElse" && !blockerText.trim()) {
        setBlockerText(" ");
        return;
      }
      onEvent({ type: "BLOCKER_SELECTED", blocker, text: blockerText });
    };

    return (
      <Question question="What is the main problem right now?" onExit={onExit}>
        {blockerText ? (
          <div className="field-stack">
            <input
              autoFocus
              value={blockerText.trimStart()}
              onChange={(event) => setBlockerText(event.target.value)}
              placeholder="A short answer is enough"
            />
            <Button variant="primary" onClick={() => onEvent({ type: "BLOCKER_SELECTED", blocker: "somethingElse", text: blockerText })}>
              Continue
            </Button>
          </div>
        ) : (
          <ChoiceGroup choices={blockerChoices} onChoose={chooseBlocker} />
        )}
      </Question>
    );
  }

  if (session.state === "TASK_CONFIRMATION") {
    if (!selectedTask) {
      return (
        <Question question="I do not have a suitable task yet." onExit={onExit}>
          <Button variant="primary" onClick={onExit}>Return to start</Button>
        </Question>
      );
    }

    return (
      <Question question="I have chosen this for now:" onExit={onExit}>
        <div className="selected-task-title">{selectedTask.title}</div>
        {session.currentActionNote && !rejectPrompt ? <p className="quiet-copy">{session.currentActionNote}</p> : null}
        {rejectPrompt ? (
          <ChoiceGroup
            choices={rejectReasons}
            onChoose={(reason) => {
              setRejectPrompt(false);
              onEvent({ type: "CONFIRM_TASK", action: "chooseElse", reason });
            }}
          />
        ) : (
          <div className="choice-stack">
            <Button variant="primary" onClick={() => onEvent({ type: "CONFIRM_TASK", action: "begin" })}>
              Help me begin
            </Button>
            <Button variant="secondary" onClick={() => setRejectPrompt(true)}>
              There is a reason I cannot do this
            </Button>
            <Button variant="quiet" onClick={() => setRejectPrompt(true)}>
              Choose something else
            </Button>
          </div>
        )}
      </Question>
    );
  }

  if (session.state === "ACTION_READY" || session.state === "ACTION_ACTIVE") {
    if (pausePrompt) {
      return (
        <Question question="What would help you restart this later?" onExit={onExit} showExit={!timerLocked}>
          <textarea value={pauseNote} onChange={(event) => setPauseNote(event.target.value)} placeholder="Optional" />
          <Button variant="primary" onClick={() => onEvent({ type: "PAUSE", note: pauseNote })}>Save my place</Button>
        </Question>
      );
    }

    return (
      <ScreenShell compact>
        <article className="active-action" aria-live="polite">
          <p className="task-label">TASK</p>
          <h1>{selectedTask?.title ?? "Current task"}</h1>
          {session.currentActionNote ? <p className="action-note">{session.currentActionNote}</p> : null}
          <p className="task-label">NEXT ACTION</p>
          <div className="next-action">{session.currentAction ?? "Open or pick up the first item."}</div>
          <TimerControl
            key={`${session.id}-${session.currentStepId ?? session.startLadderIndex ?? session.currentAction ?? "action"}`}
            seconds={settings.defaultTimerSeconds}
            startedAt={session.actionTimerStartedAt}
            endsAt={session.actionTimerEndsAt}
            onStarted={(startedAt, endsAt) => onEvent({ type: "ACTION_TIMER_STARTED", startedAt, endsAt })}
          />
          {session.startLadderIndex !== undefined ? (
            <Button
              variant="quiet"
              icon={<Volume2 size={18} />}
            onClick={() => window.setTimeout(() => undefined, 10_000)}
            >
              10-second countdown
            </Button>
          ) : null}
          <div className="action-buttons">
            <Button variant="primary" onClick={() => onEvent({ type: "DONE_ACTION" })}>Done</Button>
            <Button variant="secondary" onClick={() => onEvent({ type: "STUCK" })}>I am stuck</Button>
            {session.actionTimerExpiredAt ? (
              <Button variant="quiet" icon={<Pause size={18} />} onClick={() => setPausePrompt(true)}>Pause this</Button>
            ) : null}
          </div>
          {!timerLocked ? <Button variant="quiet" icon={<DoorOpen size={18} />} onClick={onExit}>Exit session</Button> : null}
        </article>
      </ScreenShell>
    );
  }

  if (session.state === "STUCK_REASON") {
    if (pendingStuck === "missingNeed") {
      return (
        <Question question="What is missing?" onExit={onExit} showExit={!timerLocked}>
          <ChoiceGroup
            choices={[
              { label: "An item", value: "item" },
              { label: "Information", value: "information" },
              { label: "Access or password", value: "access" },
              { label: "Another person", value: "person" },
              { label: "Money", value: "money" },
              { label: "The correct location", value: "location" },
              { label: "Something else", value: "other" }
            ]}
            onChoose={(missingType) => onEvent({ type: "STUCK_REASON", reason: "missingNeed", missingType, details: missingText })}
          />
          <input value={missingText} onChange={(event) => setMissingText(event.target.value)} placeholder="Name it if you can" />
        </Question>
      );
    }

    if (pendingStuck === "discoveredTask") {
      return (
        <Question question="Capture it, then come back here." onExit={onExit} showExit={!timerLocked}>
          <input value={discoveredTitle} onChange={(event) => setDiscoveredTitle(event.target.value)} placeholder="The other task" />
          <label className="check-row">
            <input
              type="checkbox"
              checked={discoveredUrgent}
              onChange={(event) => setDiscoveredUrgent(event.target.checked)}
            />
            It is urgent now
          </label>
          <Button
            variant="primary"
            disabled={!discoveredTitle.trim()}
            onClick={() => onEvent({ type: "CAPTURE_DISCOVERED", title: discoveredTitle, urgent: discoveredUrgent })}
          >
            Save it
          </Button>
        </Question>
      );
    }

    return (
      <Question question="What stopped you?" onExit={onExit} showExit={!timerLocked}>
        <ChoiceGroup
          choices={stuckChoices}
          onChoose={(reason) => {
            if (reason === "missingNeed" || reason === "discoveredTask") {
              setPendingStuck(reason);
            } else {
              onEvent({ type: "STUCK_REASON", reason });
            }
          }}
        />
      </Question>
    );
  }

  if (session.state === "STUCK_INTERVENTION") {
    return (
      <ScreenShell compact>
        <article className="active-action">
          <p className="action-note">{session.currentActionNote}</p>
          <p className="task-label">NEXT ACTION</p>
          <div className="next-action">{session.currentAction}</div>
          <div className="action-buttons">
            <Button variant="primary" onClick={() => onEvent({ type: "RESUME_ACTION" })}>Continue now</Button>
            <Button variant="secondary" onClick={() => onEvent({ type: "STUCK" })}>Still stuck</Button>
            {session.actionTimerExpiredAt ? <Button variant="quiet" onClick={() => setPausePrompt(true)}>Pause it</Button> : null}
          </div>
        </article>
      </ScreenShell>
    );
  }

  if (session.state === "TASK_COMPLETION_CHECK") {
    if (session.completionReflection) {
      return (
        <Question question="What result was this task supposed to produce?" onExit={onExit}>
          <textarea value={remainingText} onChange={(event) => setRemainingText(event.target.value)} placeholder="Short answer" />
          <Button variant="primary" onClick={() => onEvent({ type: "TASK_COMPLETION", answer: "yes" })}>It is finished</Button>
          <Button variant="secondary" onClick={() => onEvent({ type: "TASK_COMPLETION", answer: "almost", remainingText })}>
            One thing remains
          </Button>
        </Question>
      );
    }

    return (
      <Question question="Is the task actually finished?" onExit={onExit}>
        <ChoiceGroup
          choices={[
            { label: "Yes", value: "yes" },
            { label: "Almost — one thing remains", value: "almost" },
            { label: "I am not sure", value: "unsure" }
          ]}
          onChoose={(answer) => {
            if (answer === "almost") {
              setRemainingText(" ");
            } else {
              onEvent({ type: "TASK_COMPLETION", answer: answer as "yes" | "unsure" });
            }
          }}
        />
        {remainingText ? (
          <div className="field-stack">
            <input value={remainingText.trimStart()} onChange={(event) => setRemainingText(event.target.value)} placeholder="What remains?" />
            <Button variant="primary" onClick={() => onEvent({ type: "TASK_COMPLETION", answer: "almost", remainingText })}>
              Add that step
            </Button>
          </div>
        ) : null}
      </Question>
    );
  }

  if (session.state === "TASK_COMPLETE") {
    return (
      <Question question="Progress saved." onExit={onExit}>
        {settings.showAcknowledgements ? <p>That task is complete.</p> : null}
        <Button variant="primary" onClick={onStartAgain}>Help me choose another task</Button>
        <Button variant="quiet" onClick={onExit}>I am finished for now</Button>
      </Question>
    );
  }

  if (session.state === "TASK_PAUSED") {
    return (
      <Question question="You stopped here:" onExit={onExit}>
        <div className="next-action small">{session.currentAction}</div>
        <Button variant="primary" disabled={!session.selectedTaskId} onClick={() => session.selectedTaskId && onEvent({ type: "RESUME_PAUSED", taskId: session.selectedTaskId })}>
          Resume this task
        </Button>
        <Button variant="quiet" onClick={onExit}>I am finished for now</Button>
      </Question>
    );
  }

  return (
    <Question question="Ready when you are." onExit={onExit}>
      <Button variant="primary" onClick={onStartAgain}>Help me start</Button>
    </Question>
  );
}

function Question({
  question,
  children,
  onExit,
  showExit = true
}: {
  question: string;
  children: ReactNode;
  onExit: () => void;
  showExit?: boolean;
}) {
  return (
    <ScreenShell compact actions={showExit ? <Button variant="quiet" onClick={onExit}>Exit</Button> : undefined}>
      <div className="question-card">
        <h1>{question}</h1>
        {children}
      </div>
    </ScreenShell>
  );
}

function hasRunningActionTimer(session: Session) {
  if (!session.actionTimerEndsAt || session.actionTimerExpiredAt) return false;
  const endTime = new Date(session.actionTimerEndsAt).getTime();
  return !Number.isNaN(endTime) && endTime > Date.now();
}
