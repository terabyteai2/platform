interface PctBarProps {
  label: string;
  pct: number;
  count: number;
  featured?: boolean;
  rank?: number;
}

export function PctBar({ label, pct, count, featured, rank }: PctBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3 flex-1 min-w-0">
          {typeof rank === "number" && (
            <span
              className="voices-mono text-[11px] font-semibold shrink-0"
              style={{ color: "var(--muted)", letterSpacing: "0.08em" }}
            >
              {String(rank + 1).padStart(2, "0")}
            </span>
          )}
          <span
            className="text-[15px] font-semibold text-[var(--ink)] leading-snug bn-text flex-1 min-w-0"
            style={{ fontFamily: "Hind Siliguri, sans-serif" }}
          >
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-3 shrink-0">
          <span
            className="voices-mono text-xs"
            style={{ color: "var(--muted)" }}
          >
            {count}
          </span>
          <span
            className="voices-mono text-lg font-semibold w-14 text-right"
            style={{
              color: featured ? "var(--ink)" : "var(--ink-soft)",
              letterSpacing: "-0.02em",
            }}
          >
            {pct}%
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-[var(--hairline-soft)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full pct-bar"
          style={{
            width: `${pct}%`,
            backgroundColor: featured ? "var(--accent)" : "var(--ink-soft)",
          }}
        />
      </div>
    </div>
  );
}
