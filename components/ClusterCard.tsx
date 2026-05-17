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
  summary,
  image,
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

        {image && (
          <figure className="hidden sm:block shrink-0 w-20">
            <div
              className="aspect-[4/3] overflow-hidden rounded-[8px] border bg-[var(--surface-soft)]"
              style={{
                borderColor: "var(--hairline-soft)",
                backgroundColor: image.color ?? "var(--surface-soft)",
              }}
            >
              <img
                src={image.url}
                alt={image.alt}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            {image.source === "unsplash" && image.creditName && (
              <figcaption className="mt-1 voices-eyebrow normal-case tracking-normal leading-tight">
                Photo by{" "}
                {image.creditUrl ? (
                  <a
                    href={image.creditUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-[var(--hairline)] underline-offset-2 hover:text-[var(--ink)]"
                  >
                    {image.creditName}
                  </a>
                ) : (
                  image.creditName
                )}{" "}
                on{" "}
                <a
                  href="https://unsplash.com/?utm_source=voices_discussion_platform&utm_medium=referral"
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-[var(--hairline)] underline-offset-2 hover:text-[var(--ink)]"
                >
                  Unsplash
                </a>
              </figcaption>
            )}
          </figure>
        )}

        <div className="flex-1 min-w-0">
          {image && (
            <figure className="mb-3 sm:hidden">
              <div
                className="aspect-[16/9] overflow-hidden rounded-[8px] border bg-[var(--surface-soft)]"
                style={{
                  borderColor: "var(--hairline-soft)",
                  backgroundColor: image.color ?? "var(--surface-soft)",
                }}
              >
                <img
                  src={image.url}
                  alt={image.alt}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              {image.source === "unsplash" && image.creditName && (
                <figcaption className="mt-1 voices-eyebrow normal-case tracking-normal">
                  Photo by{" "}
                  {image.creditUrl ? (
                    <a
                      href={image.creditUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-[var(--hairline)] underline-offset-2 hover:text-[var(--ink)]"
                    >
                      {image.creditName}
                    </a>
                  ) : (
                    image.creditName
                  )}{" "}
                  on{" "}
                  <a
                    href="https://unsplash.com/?utm_source=voices_discussion_platform&utm_medium=referral"
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-[var(--hairline)] underline-offset-2 hover:text-[var(--ink)]"
                  >
                    Unsplash
                  </a>
                </figcaption>
              )}
            </figure>
          )}
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
