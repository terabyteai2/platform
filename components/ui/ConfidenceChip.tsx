import clsx from "clsx";

interface ConfidenceChipProps {
  confidence: number;
}

export function ConfidenceChip({ confidence }: ConfidenceChipProps) {
  const pct = Math.round(confidence * 100);
  const isLow = confidence < 0.7;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-pill)] text-[11px] font-semibold voices-mono",
        "border",
        isLow
          ? "bg-[#fff4ef] text-[var(--warn)] border-[#f5d4c0]"
          : "bg-[var(--surface)] text-[var(--ink-soft)] border-[var(--hairline)]"
      )}
      style={{ letterSpacing: "0.04em" }}
    >
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full",
          isLow ? "bg-[var(--warn)]" : "bg-[#2d6a30]"
        )}
      />
      ASR {pct}%
    </span>
  );
}
