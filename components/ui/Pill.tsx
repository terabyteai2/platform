import clsx from "clsx";
import { ReactNode } from "react";

type Variant = "default" | "live" | "accent" | "ai" | "ghost" | "warn";

interface PillProps {
  // New, flexible API
  children?: ReactNode;
  variant?: Variant;
  icon?: ReactNode;
  className?: string;

  // Legacy API (still used by RecordFlow / cluster pickers)
  label?: string;
  selected?: boolean;
  onClick?: () => void;
}

const variantClasses: Record<Variant, string> = {
  default:
    "bg-[var(--surface)] text-[var(--ink-soft)] border border-[var(--hairline)]",
  live:
    "bg-[var(--surface)] text-[var(--ink)] border border-[var(--hairline)]",
  accent:
    "bg-[var(--accent)] text-white border border-[var(--accent)]",
  ai:
    "bg-[var(--ink)] text-white border border-[var(--ink)]",
  ghost:
    "bg-transparent text-[var(--muted)] border border-transparent",
  warn:
    "bg-[#fbeee2] text-[var(--warn)] border border-[#eed4b8]",
};

export function Pill({
  children,
  variant = "default",
  icon,
  className,
  label,
  selected,
  onClick,
}: PillProps) {
  // Legacy interactive pill — for cluster pickers
  if (label !== undefined) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          "inline-flex items-center px-3 py-1.5 text-[13px] font-semibold rounded-[var(--r-pill)] border",
          "transition-all duration-150",
          selected
            ? "bg-[var(--accent)] text-white border-[var(--accent)]"
            : "bg-[var(--surface)] text-[var(--ink-soft)] border-[var(--hairline)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]",
          className
        )}
      >
        {label}
      </button>
    );
  }

  // New static / decorative pill
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-pill)] text-[11px] font-semibold",
        "voices-mono",
        variantClasses[variant],
        className
      )}
      style={{ letterSpacing: "0.04em" }}
    >
      {icon}
      {children}
    </span>
  );
}
