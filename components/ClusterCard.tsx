"use client";

import { useState } from "react";
import { VoteStack } from "@/components/ui/VoteStack";
import clsx from "clsx";

interface ClusterCardProps {
  id: string;
  label: string;
  summary?: string | null;
  upvotes: number;
  downvotes: number;
  takeCount: number;
  userVote?: "up" | "down" | null;
  sampleTakes?: Array<{ id: string; content: string; author: string | null }>;
  disabled?: boolean;
  focused?: boolean;
  onFocus?: () => void;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function ClusterCard({
  id,
  label,
  summary,
  upvotes,
  downvotes,
  takeCount,
  userVote,
  sampleTakes,
  disabled,
  focused,
  onFocus,
  tabIndex,
  onKeyDown,
}: ClusterCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className={clsx(
        "rounded-[12px] border p-4 space-y-3 focus-within:ring-2 focus-within:ring-[#1a1a1a] focus-within:ring-offset-1",
        "transition-all duration-150",
        focused ? "border-[#1a1a1a]" : "border-[#e2ddd1]",
        "bg-white"
      )}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      role="group"
      aria-label={label}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3
            className="text-base font-semibold text-[#14110d] leading-snug bn-text"
            style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
          >
            {label}
          </h3>
          {summary && (
            <p
              className="text-sm text-[#3a342c] mt-0.5 leading-relaxed bn-text"
              style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
            >
              {summary}
            </p>
          )}
        </div>
        <VoteStack
          clusterId={id}
          upvotes={upvotes}
          downvotes={downvotes}
          userVote={userVote}
          disabled={disabled}
        />
      </div>

      <div className="flex items-center justify-between">
        <span
          className="text-xs text-[#7a7163]"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {takeCount} মতামত
        </span>

        {sampleTakes && sampleTakes.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#7a7163] hover:text-[#3a342c] underline-offset-2 hover:underline transition-colors"
          >
            {expanded ? "কম দেখুন" : "মতামত দেখুন"}
          </button>
        )}
      </div>

      {expanded && sampleTakes && sampleTakes.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-[#e2ddd1]">
          {sampleTakes.map((take) => (
            <blockquote
              key={take.id}
              className="text-sm text-[#3a342c] italic leading-relaxed pl-3 border-l-2 border-[#e2ddd1]"
              style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
            >
              <p>"{take.content}"</p>
              {take.author && (
                <footer className="text-xs text-[#7a7163] mt-0.5 not-italic">
                  — {take.author}
                </footer>
              )}
            </blockquote>
          ))}
        </div>
      )}
    </article>
  );
}
