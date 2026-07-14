import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "quiet";
  icon?: ReactNode;
};

export function Button({ variant = "secondary", icon, children, className = "", ...props }: ButtonProps) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {icon ? <span className="button-icon" aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
