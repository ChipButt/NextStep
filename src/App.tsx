import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomNav, type View } from "./components/BottomNav";
import { DebugPanel } from "./components/DebugPanel";
import { speak, VoicePanel } from "./components/VoicePanel";
import { createSampleTasks } from "./data/sampleTasks";
import { createSession, transition } from "./engine/decisionEngine";
import { createTask, touchTask } from "./engine/taskFactory";
import type { AppData, SessionEvent, Settings, Task } from "./engine/types";
import { createEmptyData, loadAppData, saveAppData } from "./storage/localStore";
import { HistoryScreen } from "./screens/HistoryScreen";
import { useActionTimerWatcher } from "./notifications/useActionTimerWatcher";
import { SessionScreen } from "./screens/SessionScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StartScreen } from "./screens/StartScreen";
import { TaskFormDraft, TaskInboxScreen } from "./screens/TaskInboxScreen";
import { getVoicePrompt, parseVoiceCommand } from "./voice/voiceCommands";

export function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [view, setView] = useState<View>("start");

  useEffect(() => {
    saveAppData(data);
  }, [data]);

  const activeSessionIsVisible = useMemo(() => {
    if (!data.activeSession) return false;
    return !["WELCOME", "SESSION_COMPLETE"].includes(data.activeSession.state);
  }, [data.activeSession]);

  const selectedTask = useMemo(
    () => data.tasks.find((task) => task.id === data.activeSession?.selectedTaskId),
    [data.activeSession?.selectedTaskId, data.tasks]
  );

  const dispatchSessionEvent = useCallback((event: SessionEvent, returnToStart = true) => {
    setData((current) => {
      const session = current.activeSession ?? createSession();
      const result = transition(session, current.tasks, event);
      return {
        ...current,
        tasks: result.tasks,
        history: result.historyRecord ? [...current.history, result.historyRecord] : current.history,
        activeSession: result.session
      };
    });
    if (returnToStart) setView("start");
  }, []);

  const handleActionTimerExpired = useCallback(
    (expiredAt: string) => dispatchSessionEvent({ type: "ACTION_TIMER_EXPIRED", expiredAt }, false),
    [dispatchSessionEvent]
  );
  const handleActionTimerNotificationSent = useCallback(
    (sentAt: string) => dispatchSessionEvent({ type: "ACTION_TIMER_NOTIFICATION_SENT", sentAt }, false),
    [dispatchSessionEvent]
  );

  useActionTimerWatcher({
    session: data.activeSession,
    settings: data.settings,
    taskTitle: selectedTask?.title,
    onExpired: handleActionTimerExpired,
    onNotificationSent: handleActionTimerNotificationSent
  });

  function runEvent(event: SessionEvent) {
    dispatchSessionEvent(event);
  }

  function startSessionForTask(selectedTaskId?: string) {
    setData((current) => {
      const result = transition({ ...createSession(), selectedTaskId }, current.tasks, { type: "START" });
      return { ...current, activeSession: result.session };
    });
    setView("start");
  }

  function startSession() {
    startSessionForTask();
  }

  function hasAvailableTasks(tasks: Task[]) {
    return tasks.some((task) => task.status !== "completed" && task.status !== "abandoned");
  }

  function exitSession() {
    setData((current) => {
      if (hasRunningActionTimer(current.activeSession)) return current;
      return { ...current, activeSession: undefined };
    });
    setView("start");
  }

  function addTaskFromTitle(title: string) {
    setData((current) => ({
      ...current,
      tasks: [...current.tasks, createTask({ title, estimatedMinutes: 15 })]
    }));
  }

  function addTaskFromVoice(title: string, start = false) {
    setData((current) => {
      const task = createTask({ title, estimatedMinutes: 15 });
      const tasks = [...current.tasks, task];
      if (!start) return { ...current, tasks };

      const result = transition({ ...createSession(), selectedTaskId: task.id }, tasks, { type: "START" });
      return {
        ...current,
        tasks: result.tasks,
        activeSession: result.session
      };
    });
    setView(start ? "start" : "tasks");
  }

  function addTaskFromDraft(draft: TaskFormDraft) {
    setData((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        createTask({
          ...draft,
          requiredItems: draft.requiredItems?.filter(Boolean)
        })
      ]
    }));
  }

  function updateTask(task: Task) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((candidate) =>
        candidate.id === task.id ? touchTask(candidate, task) : candidate
      )
    }));
  }

  function deleteTask(taskId: string) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
      activeSession:
        current.activeSession?.selectedTaskId === taskId ? undefined : current.activeSession
    }));
  }

  function updateSettings(settings: Settings) {
    setData((current) => ({ ...current, settings }));
  }

  function loadSamples() {
    setData((current) => ({
      ...current,
      tasks: [...current.tasks, ...createSampleTasks()]
    }));
  }

  function resetData() {
    setData(createEmptyData());
    setView("start");
  }

  function importData(nextData: AppData) {
    setData(nextData);
    setView("start");
  }

  function resumeTask(taskId: string) {
    runEvent({ type: "RESUME_PAUSED", taskId });
  }

  function handleVoiceTranscript(transcript: string) {
    const command = parseVoiceCommand(transcript, {
      view,
      session: data.activeSession,
      tasks: data.tasks
    });

    switch (command.type) {
      case "START_SESSION":
        if (!hasAvailableTasks(data.tasks)) return "Tell me the task first. For example: add task call the dentist.";
        startSession();
        return "Starting.";
      case "EXIT_SESSION":
        if (hasRunningActionTimer(data.activeSession)) return "The action timer is still running.";
        exitSession();
        return "Session closed.";
      case "NAVIGATE":
        setView(command.view);
        return `Opening ${command.view}.`;
      case "ADD_TASK":
        addTaskFromVoice(command.title, command.start);
        return command.start ? `Added task: ${command.title}. Starting.` : `Added task: ${command.title}.`;
      case "LOAD_SAMPLES":
        loadSamples();
        return "Sample tasks loaded.";
      case "REPEAT_PROMPT": {
        const prompt = getVoicePrompt({ view, session: data.activeSession, tasks: data.tasks });
        speak(prompt);
        return prompt;
      }
      case "SESSION_EVENT":
        runEvent(command.event);
        return "Done.";
      case "NO_MATCH":
        return command.message;
      default:
        return "Done.";
    }
  }

  const appClass = [
    "app",
    `text-${data.settings.textSize}`,
    data.settings.highContrast ? "high-contrast" : "",
    data.settings.reducedMotion ? "reduced-motion" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={appClass}>
      <main className={activeSessionIsVisible ? "main main-session" : "main"}>
        {view === "start" && activeSessionIsVisible && data.activeSession ? (
          <SessionScreen
            session={data.activeSession}
            tasks={data.tasks}
            settings={data.settings}
            onEvent={runEvent}
            onStartAgain={startSession}
            onExit={exitSession}
          />
        ) : null}

        {view === "start" && !activeSessionIsVisible ? (
          <StartScreen
            tasks={data.tasks}
            settings={data.settings}
            onAddTask={addTaskFromTitle}
            onStart={startSession}
            onDemoSeen={() => updateSettings({ ...data.settings, firstLaunchDemoSeen: true })}
            onResumeTask={resumeTask}
          />
        ) : null}

        {view === "tasks" ? (
          <TaskInboxScreen
            tasks={data.tasks}
            onAddTask={addTaskFromDraft}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
          />
        ) : null}

        {view === "history" ? <HistoryScreen history={data.history} /> : null}

        {view === "settings" ? (
          <SettingsScreen
            data={data}
            onSettingsChange={updateSettings}
            onReset={resetData}
            onImport={importData}
            onLoadSamples={loadSamples}
          />
        ) : null}

        {data.settings.debugMode ? <DebugPanel session={data.activeSession} tasks={data.tasks} /> : null}
      </main>

      {!activeSessionIsVisible ? <BottomNav active={view} onChange={setView} /> : null}
      <VoicePanel
        settings={data.settings}
        prompt={getVoicePrompt({ view, session: data.activeSession, tasks: data.tasks })}
        onSettingsChange={updateSettings}
        onTranscript={handleVoiceTranscript}
      />
    </div>
  );
}

function hasRunningActionTimer(session: AppData["activeSession"]) {
  if (!session?.actionTimerEndsAt || session.actionTimerExpiredAt) return false;
  const endTime = new Date(session.actionTimerEndsAt).getTime();
  return !Number.isNaN(endTime) && endTime > Date.now();
}
