import { ClusterIcon } from "@/components/ui/ClusterIcon";

interface PctBarProps {
  id?: string;
  label: string;
  pct: number;
  count: number;
  featured?: boolean;
  rank?: number;
}

export function PctBar({ id, label, pct, count, featured, rank }: PctBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {typeof rank === "number" && (
            <span
              className="voices-mono text-[11px] font-semibold shrink-0"
              style={{ color: "var(--muted)", letterSpacing: "0.08em" }}
            >
              {String(rank + 1).padStart(2, "0")}
            </span>
          )}
          <ClusterIcon id={id ?? label} index={rank} size="sm" />
          <span
            className="text-[14px] font-semibold text-[var(--ink)] leading-snug bn-text flex-1 min-w-0"
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
            className="voices-mono text-base font-semibold w-12 text-right"
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
