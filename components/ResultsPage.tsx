"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { PctBar } from "@/components/ui/PctBar";

interface ClusterResult {
  id: string;
  label: string;
  summary?: string | null;
  upvotes: number;
  downvotes: number;
  takeCount: number;
  pct: number;
  featuredQuote?: string | null;
}

interface ResultsData {
  topicId: string;
  totalVoices: number;
  results: ClusterResult[];
  closesAt: string;
  status: string;
}

export function ResultsPage() {
  const { msgs } = useLocale();
  const searchParams = useSearchParams();
  const topicId = searchParams.get("topicId");
  const [data, setData] = useState<ResultsData | null>(null);
  const [activeTopic, setActiveTopic] = useState<{ id: string; question: string } | null>(null);

  const fetchResults = useCallback(async (id: string) => {
    const res = await fetch(`/api/topics/${id}/results`);
    const d = await res.json();
    setData(d);
  }, []);

  useEffect(() => {
    // If no topicId, get active topic
    async function init() {
      let id = topicId;
      if (!id) {
        const res = await fetch("/api/topics/active");
        const d = await res.json();
        id = d.topic?.id;
        if (d.topic) {
          setActiveTopic({ id: d.topic.id, question: d.topic.question });
        }
      }
      if (id) fetchResults(id);
    }
    init();
  }, [topicId, fetchResults]);

  useEffect(() => {
    if (!data || data.status !== "live") return;
    const interval = setInterval(() => {
      fetchResults(data.topicId);
    }, 10000);
    return () => clearInterval(interval);
  }, [data, fetchResults]);

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-[6px] bg-[#e2ddd1] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const topCluster = data.results[0];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-16">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1
            className="text-2xl font-semibold text-[#14110d]"
            style={{ fontFamily: "Noto Serif Bengali, Georgia, serif" }}
          >
            {msgs.results.title}
          </h1>
          {data.status === "live" && (
            <span
              className="text-xs px-2 py-0.5 rounded-full bg-[#edfbef] text-[#2d6a30] border border-[#c4dfc5]"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              ● LIVE
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="text-3xl font-bold text-[#14110d]"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {data.totalVoices.toLocaleString()}
          </span>
          <span className="text-[#7a7163] text-sm">{msgs.results.totalVoices}</span>
        </div>
      </div>

      {/* Bar chart */}
      <section className="space-y-4 mb-10">
        {data.results.map((r, idx) => (
          <PctBar
            key={r.id}
            label={r.label}
            pct={r.pct}
            count={r.takeCount}
            featured={idx === 0}
          />
        ))}
      </section>

      {/* Featured quote */}
      {topCluster?.featuredQuote && (
        <section className="mb-8">
          <h2
            className="text-sm font-semibold text-[#7a7163] uppercase tracking-wider mb-3"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {msgs.results.featuredQuote}
          </h2>
          <blockquote
            className="rounded-[12px] border border-[#e2ddd1] bg-white p-5"
          >
            <p
              className="text-base text-[#14110d] leading-relaxed italic bn-text"
              style={{ fontFamily: "Noto Serif Bengali, Georgia, serif" }}
            >
              "{topCluster.featuredQuote}"
            </p>
            <footer className="mt-2 text-xs text-[#7a7163]">
              — {topCluster.label}
            </footer>
          </blockquote>
        </section>
      )}

      {/* Per-cluster summaries */}
      <section>
        <h2
          className="text-sm font-semibold text-[#7a7163] uppercase tracking-wider mb-4"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {msgs.results.byCluster}
        </h2>
        <div className="space-y-3">
          {data.results.map((r) => (
            <div
              key={r.id}
              className="rounded-[12px] border border-[#e2ddd1] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3
                  className="text-sm font-semibold text-[#14110d] leading-snug bn-text"
                  style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                >
                  {r.label}
                </h3>
                <span
                  className="text-xs text-[#7a7163] shrink-0"
                  style={{ fontFamily: "JetBrains Mono, monospace" }}
                >
                  {r.pct}% · {r.takeCount} মতামত
                </span>
              </div>
              {r.summary && (
                <p
                  className="text-xs text-[#7a7163] leading-relaxed bn-text"
                  style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                >
                  {r.summary}
                </p>
              )}
              <div className="flex gap-3 mt-2 text-xs text-[#7a7163]">
                <span>↑ {r.upvotes}</span>
                <span>↓ {r.downvotes}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
