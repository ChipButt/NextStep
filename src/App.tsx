import { useEffect, useMemo, useState } from "react";
import { BottomNav, type View } from "./components/BottomNav";
import { DebugPanel } from "./components/DebugPanel";
import { speak, VoicePanel } from "./components/VoicePanel";
import { createSampleTasks } from "./data/sampleTasks";
import { createSession, transition } from "./engine/decisionEngine";
import { createTask, touchTask } from "./engine/taskFactory";
import type { AppData, SessionEvent, Settings, Task } from "./engine/types";
import { createEmptyData, loadAppData, saveAppData } from "./storage/localStore";
import { HistoryScreen } from "./screens/HistoryScreen";
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

  function runEvent(event: SessionEvent) {
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
    setView("start");
  }

  function startSession() {
    setData((current) => {
      const result = transition(createSession(), current.tasks, { type: "START" });
      return { ...current, activeSession: result.session };
    });
    setView("start");
  }

  function exitSession() {
    setData((current) => ({ ...current, activeSession: undefined }));
    setView("start");
  }

  function addTaskFromTitle(title: string) {
    setData((current) => ({
      ...current,
      tasks: [...current.tasks, createTask({ title, estimatedMinutes: 15 })]
    }));
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
        startSession();
        return "Starting.";
      case "EXIT_SESSION":
        exitSession();
        return "Session closed.";
      case "NAVIGATE":
        setView(command.view);
        return `Opening ${command.view}.`;
      case "ADD_TASK":
        addTaskFromTitle(command.title);
        return `Added task: ${command.title}.`;
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
