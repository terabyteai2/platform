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
    // Optimistic update
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
      // Revert
      setLocalVote(prev);
      setLocalUp(upvotes);
      setLocalDown(downvotes);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleVote("up")}
        disabled={loading || disabled}
        aria-label="একমত"
        className={clsx(
          "flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs font-medium",
          "border transition-all",
          localVote === "up"
            ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
            : "bg-white text-[#3a342c] border-[#e2ddd1] hover:border-[#1a1a1a]",
          "disabled:opacity-50"
        )}
      >
        <span>↑</span>
        <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{localUp}</span>
      </button>
      <button
        onClick={() => handleVote("down")}
        disabled={loading || disabled}
        aria-label="দ্বিমত"
        className={clsx(
          "flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs font-medium",
          "border transition-all",
          localVote === "down"
            ? "bg-[#b85c1e] text-white border-[#b85c1e]"
            : "bg-white text-[#3a342c] border-[#e2ddd1] hover:border-[#b85c1e]",
          "disabled:opacity-50"
        )}
      >
        <span>↓</span>
        <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{localDown}</span>
      </button>
    </div>
  );
}
