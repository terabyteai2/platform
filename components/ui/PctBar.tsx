interface PctBarProps {
  label: string;
  pct: number;
  count: number;
  featured?: boolean;
}

export function PctBar({ label, pct, count, featured }: PctBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-4">
        <span
          className="text-sm font-medium text-[#14110d] leading-snug flex-1 min-w-0 bn-text"
          style={{ fontFamily: "var(--font-bangla-sans, 'Hind Siliguri', sans-serif)" }}
        >
          {label}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs text-[#7a7163]"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {count}
          </span>
          <span
            className="text-sm font-semibold text-[#14110d] w-10 text-right"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {pct}%
          </span>
        </div>
      </div>
      <div className="h-2 bg-[#e2ddd1] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full pct-bar"
          style={{
            width: `${pct}%`,
            backgroundColor: featured ? "#1a1a1a" : "#3a342c",
          }}
        />
      </div>
    </div>
  );
}
