import { ScreenShell } from "../components/ScreenShell";
import type { SessionRecord } from "../engine/types";

type HistoryScreenProps = {
  history: SessionRecord[];
};

export function HistoryScreen({ history }: HistoryScreenProps) {
  return (
    <ScreenShell title="History">
      {history.length === 0 ? <p className="quiet-copy">No sessions recorded yet.</p> : null}
      <div className="task-list">
        {history
          .slice()
          .reverse()
          .map((record) => (
            <article className="task-row history-row" key={record.id}>
              <div>
                <h2>{record.taskTitle}</h2>
                <p>
                  {record.result} · {record.actionsCompleted.length} actions · {Math.round(record.durationSeconds / 60)} min
                </p>
                <p>{new Date(record.endedAt).toLocaleString()}</p>
              </div>
              {record.interventionsUsed.length ? (
                <p className="intervention-list">{record.interventionsUsed.join(", ")}</p>
              ) : null}
            </article>
          ))}
      </div>
    </ScreenShell>
  );
}
