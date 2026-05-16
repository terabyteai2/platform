"use client";

import { useEffect, useState, useCallback } from "react";
import { TopicHero } from "@/components/TopicHero";
import { ClusterCard } from "@/components/ClusterCard";
import { useLocale } from "@/lib/locale-context";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";

interface Cluster {
  id: string;
  label: string;
  summary?: string | null;
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
  closesAt: string;
  status: string;
  totalTakes: number;
  clusters: Cluster[];
}

export function ActiveTopicPage() {
  const { msgs } = useLocale();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusedIdx, setFocusedIdx] = useState(-1);

  const fetchTopic = useCallback(async () => {
    try {
      const res = await fetch("/api/topics/active", { cache: "no-store" });
      const data = await res.json();
      setTopic(data.topic);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopic();
    // Poll every 10s while topic is live
    const interval = setInterval(fetchTopic, 10000);
    return () => clearInterval(interval);
  }, [fetchTopic]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-[12px] bg-[#e2ddd1] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 text-center">
        <p
          className="text-[#7a7163] text-lg"
          style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
        >
          {msgs.topic.noTopic}
        </p>
        <p className="text-[#7a7163] text-sm mt-2">
          Check back next week for a new topic.
        </p>
      </div>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
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
        fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clusterId: cluster.id, direction: "up" }),
        }).then(() => fetchTopic());
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
      <TopicHero
        id={topic.id}
        week={topic.week}
        question={topic.question}
        questionEn={topic.questionEn}
        context={topic.context}
        closesAt={topic.closesAt}
        status={topic.status}
        totalTakes={topic.totalTakes}
        category={topic.category}
      />

      <div className="space-y-3">
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
            onFocus={() => setFocusedIdx(idx)}
            tabIndex={0}
            onKeyDown={(e) => handleKeyDown(e, idx)}
          />
        ))}
      </div>

      {topic.status === "live" && (
        <div className="mt-8 flex justify-center">
          <Link href={`/record?topicId=${topic.id}`}>
            <Btn size="lg" variant="primary">
              {msgs.topic.addVoice} →
            </Btn>
          </Link>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link
          href={`/results?topicId=${topic.id}`}
          className="text-sm text-[#7a7163] hover:text-[#3a342c] underline underline-offset-4"
        >
          {msgs.results.title} →
        </Link>
      </div>
    </div>
  );
}
