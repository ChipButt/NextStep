import type { ReactNode } from "react";

type ScreenShellProps = {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
};

export function ScreenShell({ title, children, actions, compact = false }: ScreenShellProps) {
  return (
    <section className={`screen-shell ${compact ? "screen-shell-compact" : ""}`}>
      {title || actions ? (
        <header className="screen-header">
          {title ? <h1>{title}</h1> : <span />}
          {actions ? <div className="screen-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
