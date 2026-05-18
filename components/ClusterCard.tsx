"use client";

import { VoteStack } from "@/components/ui/VoteStack";
import clsx from "clsx";

interface ClusterCardProps {
  id: string;
  label: string;
  summary?: string | null;
  image?: {
    url: string;
    alt: string;
    source: string;
    creditName?: string | null;
    creditUrl?: string | null;
    color?: string | null;
  } | null;
  upvotes: number;
  downvotes: number;
  takeCount: number;
  userVote?: "up" | "down" | null;
  sampleTakes?: Array<{ id: string; content: string; author: string | null }>;
  disabled?: boolean;
  focused?: boolean;
  index?: number;
  onFocus?: () => void;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function ClusterCard({
  id,
  label,
  upvotes,
  downvotes,
  takeCount,
  userVote,
  disabled,
  focused,
  index,
  onFocus,
  tabIndex,
  onKeyDown,
}: ClusterCardProps) {
  const netVotes = upvotes - downvotes;

  return (
    <article
      className={clsx(
        "voices-card voices-card-hover bg-[var(--surface)] px-2 py-1.5 shadow-none",
        "focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--paper)]",
        focused && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--paper)]"
      )}
      style={{ borderColor: "var(--ink)", borderRadius: 9 }}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      role="group"
      aria-label={label}
    >
      <div className="flex items-center gap-2">
        <VoteStack
          clusterId={id}
          upvotes={upvotes}
          downvotes={downvotes}
          userVote={userVote}
          disabled={disabled}
          showCount={false}
        />
        <div className="flex-1 min-w-0">
          <div className="mb-0.5 flex items-center gap-2">
            {typeof index === "number" && (
              <span className="voices-mono text-[10px] font-bold text-[var(--ink)]">
                {String.fromCharCode(65 + index)}
              </span>
            )}
          </div>
          <h3
            className="text-[13px] sm:text-[14px] font-bold text-[var(--ink)] leading-tight bn-text line-clamp-1"
            style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
          >
            {label}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <span className="voices-mono block text-[13px] font-bold text-[var(--ink)]">
            {netVotes > 0 ? `+${netVotes}` : netVotes}
          </span>
          <span className="voices-mono block text-[9px] text-[var(--muted)]">
            {takeCount}
          </span>
        </div>
      </div>
    </article>
  );
}
