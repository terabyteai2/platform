"use client";

import { useState } from "react";
import { VoteStack } from "@/components/ui/VoteStack";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/ui/Icon";
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
  index?: number;
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
  index,
  onFocus,
  tabIndex,
  onKeyDown,
}: ClusterCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className={clsx(
        "voices-card voices-card-hover p-5 sm:p-6",
        "focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--paper)]",
        focused && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--paper)]"
      )}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      role="group"
      aria-label={label}
    >
      <div className="flex items-start gap-4">
        {/* Index marker */}
        {typeof index === "number" && (
          <div
            className="shrink-0 w-7 h-7 rounded-[6px] flex items-center justify-center voices-mono text-[11px] font-semibold"
            style={{
              background: "var(--accent-soft)",
              color: "var(--ink)",
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3
            className="text-[17px] sm:text-lg font-semibold text-[var(--ink)] leading-snug bn-text"
            style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
          >
            {label}
          </h3>
          {summary && (
            <p
              className="text-[14px] text-[var(--ink-soft)] mt-1.5 leading-relaxed bn-text"
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

      <div className="mt-4 pt-3 flex items-center justify-between gap-3 border-t flex-wrap" style={{ borderColor: "var(--hairline-soft)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <Pill variant="ai" icon={<Icon.Sparkle size={9} color="#fff" sw={2.5} />}>
            AI CLUSTERED
          </Pill>
          <span className="voices-eyebrow">
            {takeCount} {takeCount === 1 ? "VOICE" : "VOICES"} · ↑{upvotes} ↓{downvotes}
          </span>
        </div>

        {sampleTakes && sampleTakes.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="voices-mono text-[11px] font-semibold tracking-wider uppercase text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors inline-flex items-center gap-1"
          >
            {expanded ? "− HIDE" : "+ READ"}
          </button>
        )}
      </div>

      {expanded && sampleTakes && sampleTakes.length > 0 && (
        <div className="mt-4 space-y-3">
          {sampleTakes.map((take) => (
            <blockquote
              key={take.id}
              className="pl-4 border-l-2 voices-quote text-[15px] text-[var(--ink-soft)] leading-relaxed bn-serif"
              style={{
                borderColor: "var(--accent)",
                fontFamily: "Noto Serif Bengali, Newsreader, Georgia, serif",
              }}
            >
              <p>&ldquo;{take.content}&rdquo;</p>
              {take.author && (
                <footer
                  className="voices-eyebrow mt-2"
                  style={{ fontStyle: "normal" }}
                >
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
