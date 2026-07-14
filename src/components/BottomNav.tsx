import { Clock3, Home, ListTodo, Settings, TimerReset } from "lucide-react";

export type View = "start" | "tasks" | "history" | "settings";

type BottomNavProps = {
  active: View;
  onChange: (view: View) => void;
};

const items = [
  { id: "start", label: "Start", icon: Home },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "history", label: "History", icon: Clock3 },
  { id: "settings", label: "Settings", icon: Settings }
] as const;

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {items.map((item) => {
        const Icon = item.id === "history" ? TimerReset : item.icon;
        return (
          <button
            key={item.id}
            className={active === item.id ? "nav-item nav-item-active" : "nav-item"}
            type="button"
            onClick={() => onChange(item.id)}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
