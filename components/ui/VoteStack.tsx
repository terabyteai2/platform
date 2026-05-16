"use client";

import { useState } from "react";
import clsx from "clsx";

interface VoteStackProps {
  clusterId: string;
  upvotes: number;
  downvotes: number;
  userVote?: "up" | "down" | null;
  disabled?: boolean;
  onVote?: (clusterId: string, direction: "up" | "down") => Promise<void>;
}

export function VoteStack({
  clusterId,
  upvotes,
  downvotes,
  userVote,
  disabled,
  onVote,
}: VoteStackProps) {
  const [localVote, setLocalVote] = useState<"up" | "down" | null>(userVote ?? null);
  const [localUp, setLocalUp] = useState(upvotes);
  const [localDown, setLocalDown] = useState(downvotes);
  const [loading, setLoading] = useState(false);

  async function handleVote(dir: "up" | "down") {
    if (loading || disabled) return;
    setLoading(true);

    const prev = localVote;
    if (prev === dir) {
      setLocalVote(null);
      if (dir === "up") setLocalUp((v) => v - 1);
      else setLocalDown((v) => v - 1);
    } else {
      if (prev === "up") setLocalUp((v) => v - 1);
      if (prev === "down") setLocalDown((v) => v - 1);
      setLocalVote(dir);
      if (dir === "up") setLocalUp((v) => v + 1);
      else setLocalDown((v) => v + 1);
    }

    try {
      if (onVote) await onVote(clusterId, dir);
      else {
        await fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clusterId, direction: dir }),
        });
      }
    } catch {
      setLocalVote(prev);
      setLocalUp(upvotes);
      setLocalDown(downvotes);
    } finally {
      setLoading(false);
    }
  }

  const net = localUp - localDown;

  return (
    <div className="flex flex-col items-stretch shrink-0 rounded-[10px] border overflow-hidden"
      style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}
    >
      <button
        onClick={() => handleVote("up")}
        disabled={loading || disabled}
        aria-label="একমত"
        className={clsx(
          "flex items-center justify-center w-12 h-9 transition-colors",
          localVote === "up"
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--ink-soft)] hover:bg-[var(--accent-soft)]",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 15 12 9 18 15" />
        </svg>
      </button>
      <div
        className="flex items-center justify-center text-center px-2 py-1.5 voices-mono text-[13px] font-semibold border-y"
        style={{
          borderColor: "var(--hairline)",
          color: net > 0 ? "var(--ink)" : net < 0 ? "var(--warn)" : "var(--muted)",
          minWidth: 48,
        }}
        title={`↑${localUp} · ↓${localDown}`}
      >
        {net > 0 ? `+${net}` : net}
      </div>
      <button
        onClick={() => handleVote("down")}
        disabled={loading || disabled}
        aria-label="দ্বিমত"
        className={clsx(
          "flex items-center justify-center w-12 h-9 transition-colors",
          localVote === "down"
            ? "bg-[var(--warn)] text-white"
            : "text-[var(--ink-soft)] hover:bg-[var(--accent-soft)]",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}
