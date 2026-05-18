"use client";

import { useEffect, useState, useCallback } from "react";
import { TopicHero } from "@/components/TopicHero";
import { ClusterCard } from "@/components/ClusterCard";
import { useLocale } from "@/lib/locale-context";
import { useCurrentUser } from "@/lib/user-context";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";

interface Cluster {
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
  sampleTakes: Array<{ id: string; content: string; author: string | null }>;
}

interface Topic {
  id: string;
  week: number;
  category: string;
  question: string;
  questionEn?: string | null;
  context?: string | null;
  image?: {
    url: string;
    alt: string;
    source: string;
    creditName?: string | null;
    creditUrl?: string | null;
    color?: string | null;
  } | null;
  closesAt: string;
  status: string;
  totalTakes: number;
  clusters: Cluster[];
}

export function ActiveTopicPage() {
  const { msgs } = useLocale();
  const { requireName } = useCurrentUser();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusedIdx, setFocusedIdx] = useState(-1);

  const fetchTopic = useCallback(async () => {
    try {
      const res = await fetch("/api/topics/active", { cache: "no-store" });
      if (!res.ok) return; // keep existing data on server error
      const data = await res.json();
      if (data.topic) setTopic(data.topic);
    } catch {
      // network error — keep existing data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchTopic();
    }, 0);
    // Poll every 10s while topic is live
    const interval = setInterval(fetchTopic, 10000);
    return () => {
      window.clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchTopic]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-8">
        <div className="space-y-4">
          <div className="h-4 w-24 rounded bg-[var(--hairline)] animate-pulse" />
          <div className="h-12 w-3/4 rounded bg-[var(--hairline)] animate-pulse" />
          <div className="h-6 w-2/3 rounded bg-[var(--hairline-soft)] animate-pulse" />
          <div className="pt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-[16px] bg-[var(--hairline-soft)] animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-24 text-center space-y-3">
        <span className="voices-eyebrow">NO ACTIVE TOPIC</span>
        <p className="voices-display text-3xl text-[var(--ink)]">
          The next question is brewing.
        </p>
        <p className="text-sm text-[var(--muted)]">
          Check back next week for a new topic.
        </p>
      </div>
    );
  }

  const handleKeyDown = async (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx(Math.min(idx + 1, topic.clusters.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx(Math.max(idx - 1, 0));
    } else if (e.key === " " || e.key === "Space") {
      e.preventDefault();
      // Trigger upvote on space
      const cluster = topic.clusters[idx];
      if (cluster) {
        const hasName = await requireName(msgs.avatar.beforeVote);
        if (!hasName) return;
        fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clusterId: cluster.id, direction: "up" }),
        }).then(() => fetchTopic());
      }
    }
  };

  return (
    <div className="max-w-[430px] mx-auto pb-24">
      <TopicHero
        id={topic.id}
        week={topic.week}
        question={topic.question}
        questionEn={topic.questionEn}
        context={topic.context}
        image={topic.image}
        closesAt={topic.closesAt}
        status={topic.status}
        totalTakes={topic.totalTakes}
        category={topic.category}
      />

      <div className="px-4 mb-3 flex items-center justify-between gap-3">
        <span className="text-[11px] text-[var(--muted)]">
          ↑ vote opinions you agree with
        </span>
        <span className="text-[11px] text-[var(--muted)]">
          Sort: <strong className="text-[var(--ink)]">Top</strong>
        </span>
      </div>

      <div className="space-y-1.5 px-4">
        {topic.clusters.map((cluster, idx) => (
          <ClusterCard
            key={cluster.id}
            id={cluster.id}
            label={cluster.label}
            summary={cluster.summary}
            upvotes={cluster.upvotes}
            downvotes={cluster.downvotes}
            takeCount={cluster.takeCount}
            userVote={cluster.userVote}
            sampleTakes={cluster.sampleTakes}
            disabled={topic.status !== "live"}
            focused={focusedIdx === idx}
            index={idx}
            onFocus={() => setFocusedIdx(idx)}
            tabIndex={0}
            onKeyDown={(e) => handleKeyDown(e, idx)}
          />
        ))}
      </div>

      {topic.status === "live" && (
        <div className="fixed left-0 right-0 bottom-16 z-40 flex justify-center pointer-events-none">
          <Link href={`/record?topicId=${topic.id}`} className="pointer-events-auto">
            <Btn
              size="lg"
              variant="accent"
              className="min-w-44 rounded-[9px] border-2 border-[var(--ink)] shadow-[0_12px_26px_-12px_rgba(0,0,0,0.65)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              {msgs.topic.addVoice}
            </Btn>
          </Link>
        </div>
      )}
    </div>
  );
}
