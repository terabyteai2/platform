"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { PctBar } from "@/components/ui/PctBar";
import { Pill } from "@/components/ui/Pill";
import { ClusterIcon } from "@/components/ui/ClusterIcon";

interface ClusterResult {
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-16">
        <div className="space-y-4">
          <div className="h-4 w-24 rounded bg-[var(--hairline)] animate-pulse" />
          <div className="h-10 w-2/3 rounded bg-[var(--hairline)] animate-pulse" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded bg-[var(--hairline-soft)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const topCluster = data.results[0];

  return (
    <div className="max-w-[430px] mx-auto px-4 pt-4 pb-20">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="voices-serif text-[18px] font-semibold text-[var(--ink)]">Results</span>
          {data.status === "live" ? (
            <Pill variant="live" icon={<span className="voices-live-dot" />}>LIVE</Pill>
          ) : (
            <Pill variant="ghost">CLOSED</Pill>
          )}
        </div>

        <span className="voices-eyebrow">WEEK 14 · {data.totalVoices.toLocaleString()} VOICES</span>
        <h1 className="voices-display text-[22px] text-[var(--ink)] mt-2 mb-3">
          {msgs.results.title}
        </h1>
        <div className="inline-flex rounded-full bg-[var(--surface-soft)] p-0.5 border border-[var(--hairline)]">
          <button className="rounded-full bg-[var(--ink)] px-3 py-1 text-[10px] font-semibold text-white voices-mono">
            BY CLUSTER
          </button>
          <button className="rounded-full px-3 py-1 text-[10px] font-semibold text-[var(--muted)] voices-mono">
            OVER TIME
          </button>
          <button className="rounded-full px-3 py-1 text-[10px] font-semibold text-[var(--muted)] voices-mono">
            BY ROLE
          </button>
        </div>
      </div>

      {/* Bar chart */}
      <section className="mb-7">
        <div className="space-y-3">
          {data.results.map((r, idx) => (
            <PctBar
              key={r.id}
              id={r.id}
              label={r.label}
              pct={r.pct}
              count={r.takeCount}
              featured={idx === 0}
              rank={idx}
            />
          ))}
        </div>
      </section>

      {/* Featured quote */}
      {topCluster?.featuredQuote && (
        <section className="mb-7">
          <div className="mb-3">
            <span className="voices-eyebrow">{msgs.results.featuredQuote.toUpperCase()}</span>
          </div>
          <blockquote className="voices-card p-4 relative">
            <span
              className="absolute -top-2 left-5 voices-serif text-5xl leading-none"
              style={{ color: "var(--accent)", fontWeight: 500 }}
            >
              &ldquo;
            </span>
            <p
              className="voices-quote text-lg sm:text-xl text-[var(--ink)] leading-relaxed bn-serif pl-5"
              style={{ fontFamily: "Noto Serif Bengali, Newsreader, Georgia, serif" }}
            >
              {topCluster.featuredQuote}
            </p>
            <footer className="mt-3 pl-5 voices-eyebrow">
              — {topCluster.label}
            </footer>
          </blockquote>
        </section>
      )}

      {/* Per-cluster summaries */}
      <section>
        <div className="mb-3">
          <span className="voices-eyebrow">{msgs.results.byCluster.toUpperCase()}</span>
        </div>
        <div className="space-y-2">
          {data.results.map((r, idx) => (
            <div key={r.id} className="voices-card p-3">
              <div className="flex gap-3">
                <ClusterIcon id={r.id} index={idx} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-baseline gap-3 flex-1 min-w-0">
                      <span
                        className="voices-mono text-[11px] font-semibold shrink-0"
                        style={{ color: "var(--muted)", letterSpacing: "0.08em" }}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h3
                        className="text-[15px] font-semibold text-[var(--ink)] leading-snug bn-text"
                        style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                      >
                        {r.label}
                      </h3>
                    </div>
                    <span
                      className="voices-mono text-[12px] font-semibold shrink-0"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      {r.pct}%
                    </span>
                  </div>
                  {r.summary && (
                    <p
                      className="text-[13px] text-[var(--ink-soft)] leading-snug bn-text pl-7 line-clamp-2"
                      style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                    >
                      {r.summary}
                    </p>
                  )}
                  <div className="mt-2 pl-7 voices-eyebrow normal-case tracking-normal">
                    {r.takeCount} voices · পক্ষে {r.upvotes} · বিপক্ষে {r.downvotes}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
