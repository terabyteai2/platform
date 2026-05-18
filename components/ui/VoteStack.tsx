"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/user-context";
import { Icon } from "@/components/ui/Icon";
import clsx from "clsx";

interface VoteStackProps {
  clusterId: string;
  upvotes: number;
  downvotes: number;
  userVote?: "up" | "down" | null;
  disabled?: boolean;
  onVote?: (clusterId: string, direction: "up" | "down") => Promise<void>;
  showCount?: boolean;
}

export function VoteStack({
  clusterId,
  upvotes,
  downvotes,
  userVote,
  disabled,
  onVote,
  showCount = true,
}: VoteStackProps) {
  const { requireName } = useCurrentUser();
  const [localVote, setLocalVote] = useState<"up" | "down" | null>(userVote ?? null);
  const [localUp, setLocalUp] = useState(upvotes);
  const [localDown, setLocalDown] = useState(downvotes);
  const [loading, setLoading] = useState(false);

  async function handleVote(dir: "up" | "down") {
    if (loading || disabled) return;
    setLoading(true);

    const hasName = await requireName(
      "Tell us your name or username before your vote is saved."
    );
    if (!hasName) {
      setLoading(false);
      return;
    }

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
        const res = await fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clusterId, direction: dir }),
        });
        if (!res.ok) throw new Error("Vote was not saved.");
      }
    } catch {
      setLocalVote(prev);
      setLocalUp(upvotes);
      setLocalDown(downvotes);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex shrink-0 items-center overflow-hidden rounded-[7px] border bg-[var(--surface)]"
      style={{ borderColor: "var(--ink)" }}
    >
      <button
        onClick={() => handleVote("up")}
        disabled={loading || disabled}
        aria-label="সঠিক"
        className={clsx(
          "flex h-8 w-8 items-center justify-center transition-colors",
          localVote === "up"
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--ink)] hover:bg-[var(--accent-soft)]",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Icon.ThumbsUp size={14} sw={2.1} />
      </button>
      {showCount && (
        <div
          className="flex h-8 items-center justify-center border-x px-2 text-center"
          style={{
            borderColor: "var(--ink)",
            color: "var(--ink)",
          }}
          title={`সঠিক ${localUp} · ভুল ${localDown}`}
        >
          <span className="voices-mono text-[11px] font-bold leading-tight">{localUp}</span>
        </div>
      )}
      <button
        onClick={() => handleVote("down")}
        disabled={loading || disabled}
        aria-label="ভুল"
        className={clsx(
          "flex h-8 w-8 items-center justify-center transition-colors",
          localVote === "down"
            ? "bg-[var(--warn)] text-white"
            : "text-[var(--ink)] hover:bg-[var(--accent-soft)]",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Icon.ThumbsDown size={14} sw={2.1} />
      </button>
    </div>
  );
}
