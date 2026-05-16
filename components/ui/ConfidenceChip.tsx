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
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        "border",
        isLow
          ? "bg-[#fff4ef] text-[#b85c1e] border-[#f5d4c0]"
          : "bg-[#f0f5f0] text-[#2d6a30] border-[#c4dfc5]"
      )}
      style={{ fontFamily: "JetBrains Mono, monospace" }}
    >
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full",
          isLow ? "bg-[#b85c1e]" : "bg-[#2d6a30]"
        )}
      />
      {pct}%
    </span>
  );
}
