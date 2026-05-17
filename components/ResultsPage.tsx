"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { PctBar } from "@/components/ui/PctBar";
import { Pill } from "@/components/ui/Pill";

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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-16">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-5">
          <Pill variant="default">RESULTS</Pill>
          {data.status === "live" ? (
            <Pill variant="live" icon={<span className="voices-live-dot" />}>LIVE</Pill>
          ) : (
            <Pill variant="ghost">CLOSED</Pill>
          )}
        </div>

        <h1 className="voices-display text-4xl sm:text-5xl text-[var(--ink)] mb-6">
          {msgs.results.title}
        </h1>

        <hr className="voices-rule mb-5" />

        <div className="flex items-baseline gap-3">
          <span
            className="voices-mono text-4xl sm:text-5xl font-semibold text-[var(--ink)]"
            style={{ letterSpacing: "-0.025em" }}
          >
            {data.totalVoices.toLocaleString()}
          </span>
          <span className="voices-eyebrow">{msgs.results.totalVoices.toUpperCase()}</span>
        </div>
      </div>

      {/* Bar chart */}
      <section className="mb-12">
        <div className="mb-5 flex items-center justify-between">
          <span className="voices-eyebrow">DISTRIBUTION</span>
          <span className="voices-eyebrow">{data.results.length} CLUSTERS</span>
        </div>
        <div className="space-y-5">
          {data.results.map((r, idx) => (
            <PctBar
              key={r.id}
              label={r.label}
              pct={r.pct}
              count={r.takeCount}
              image={idx < 4 ? r.image : null}
              featured={idx === 0}
              rank={idx}
            />
          ))}
        </div>
      </section>

      {/* Featured quote */}
      {topCluster?.featuredQuote && (
        <section className="mb-12">
          <div className="mb-4">
            <span className="voices-eyebrow">{msgs.results.featuredQuote.toUpperCase()}</span>
          </div>
          <blockquote className="voices-card p-7 sm:p-8 relative">
            <span
              className="absolute -top-2 left-6 voices-serif text-6xl leading-none"
              style={{ color: "var(--accent)", fontWeight: 500 }}
            >
              &ldquo;
            </span>
            <p
              className="voices-quote text-xl sm:text-2xl text-[var(--ink)] leading-relaxed bn-serif pl-6"
              style={{ fontFamily: "Noto Serif Bengali, Newsreader, Georgia, serif" }}
            >
              {topCluster.featuredQuote}
            </p>
            <footer className="mt-4 pl-6 voices-eyebrow">
              — {topCluster.label}
            </footer>
          </blockquote>
        </section>
      )}

      {/* Per-cluster summaries */}
      <section>
        <div className="mb-5">
          <span className="voices-eyebrow">{msgs.results.byCluster.toUpperCase()}</span>
        </div>
        <div className="space-y-3">
          {data.results.map((r, idx) => (
            <div key={r.id} className="voices-card p-5">
              <div className="flex flex-col sm:flex-row gap-4">
                {idx < 4 && r.image && (
                  <figure className="sm:w-28 shrink-0">
                    <div
                      className="aspect-[4/3] overflow-hidden rounded-[8px] border bg-[var(--surface-soft)]"
                      style={{
                        borderColor: "var(--hairline-soft)",
                        backgroundColor: r.image.color ?? "var(--surface-soft)",
                      }}
                    >
                      <img
                        src={r.image.url}
                        alt={r.image.alt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {r.image.source === "unsplash" && r.image.creditName && (
                      <figcaption className="mt-1 voices-eyebrow normal-case tracking-normal leading-tight">
                        Photo by{" "}
                        {r.image.creditUrl ? (
                          <a
                            href={r.image.creditUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-[var(--hairline)] underline-offset-2 hover:text-[var(--ink)]"
                          >
                            {r.image.creditName}
                          </a>
                        ) : (
                          r.image.creditName
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
                  <div className="flex items-start justify-between gap-3 mb-2">
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
                      className="text-[13px] text-[var(--ink-soft)] leading-relaxed bn-text pl-7"
                      style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                    >
                      {r.summary}
                    </p>
                  )}
                  <div className="mt-3 pl-7 voices-eyebrow">
                    {r.takeCount} VOICES · ↑{r.upvotes} ↓{r.downvotes}
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
