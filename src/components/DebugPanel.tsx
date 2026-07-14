import type { Session, Task } from "../engine/types";

type DebugPanelProps = {
  session?: Session;
  tasks: Task[];
};

export function DebugPanel({ session, tasks }: DebugPanelProps) {
  if (!session) return null;
  const selected = tasks.find((task) => task.id === session.selectedTaskId);

  return (
    <details className="debug-panel">
      <summary>Debug</summary>
      <dl>
        <dt>State</dt>
        <dd>{session.state}</dd>
        <dt>Selected task</dt>
        <dd>{selected?.title ?? "None"}</dd>
        <dt>Current step</dt>
        <dd>{session.currentStepId ?? "None"}</dd>
        <dt>Current action</dt>
        <dd>{session.currentAction ?? "None"}</dd>
      </dl>
      <pre>{JSON.stringify({ inputs: session.inputs, rejected: session.rejectedTaskCounts }, null, 2)}</pre>
      {session.lastSelection ? (
        <>
          <h2>Selection</h2>
          <pre>{JSON.stringify(session.lastSelection, null, 2)}</pre>
        </>
      ) : null}
      <h2>State history</h2>
      <ol>
        {session.stateHistory.map((state, index) => (
          <li key={`${state}-${index}`}>{state}</li>
        ))}
      </ol>
    </details>
  );
}
