"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import clsx from "clsx";

interface AdminTopic {
  id: string;
  week: number;
  category: string;
  question: string;
  questionEn?: string | null;
  context?: string | null;
  opensAt: string;
  closesAt: string;
  status: "draft" | "scheduled" | "live" | "closed";
  createdAt: string;
  _count: { takes: number; clusters: number };
}

const STATUS_FILTERS: Array<{ value: AdminTopic["status"] | "all"; label: string }> = [
  { value: "all", label: "ALL" },
  { value: "live", label: "LIVE" },
  { value: "scheduled", label: "SCHEDULED" },
  { value: "draft", label: "DRAFT" },
  { value: "closed", label: "CLOSED" },
];

function statusPill(status: AdminTopic["status"]) {
  if (status === "live") return <Pill variant="live" icon={<span className="voices-live-dot" />}>LIVE</Pill>;
  if (status === "scheduled") return <Pill variant="default">SCHEDULED</Pill>;
  if (status === "draft") return <Pill variant="ghost">DRAFT</Pill>;
  return <Pill variant="ghost">CLOSED</Pill>;
}

export function AdminTopicsListPage() {
  const [topics, setTopics] = useState<AdminTopic[] | null>(null);
  const [filter, setFilter] = useState<AdminTopic["status"] | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/topics", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error?.toString?.() ?? "Failed to load topics.");
      return;
    }
    setTopics(data.topics ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = (topics ?? []).filter((t) => filter === "all" || t.status === filter);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-16">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Pill variant="default">ADMIN</Pill>
            <Link
              href="/admin"
              className="voices-eyebrow hover:text-[var(--ink)] transition-colors"
            >
              ← BACK
            </Link>
          </div>
          <h1 className="voices-display text-4xl sm:text-5xl text-[var(--ink)]">
            Topics
          </h1>
        </div>
        <Link
          href="/admin/compose"
          className="voices-card voices-card-hover px-4 py-2 voices-mono text-[12px] font-semibold tracking-wider uppercase text-[var(--ink)]"
        >
          + New topic
        </Link>
      </div>

      <hr className="voices-rule mb-6" />

      <div className="flex gap-1 mb-6 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={clsx(
              "voices-mono text-[11px] font-semibold tracking-wider px-3 py-1.5 rounded-[6px] transition-colors",
              filter === f.value
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 text-[13px] rounded-[10px] px-3.5 py-2.5"
          style={{ background: "#fff4ef", color: "var(--warn)", border: "1px solid #f5d4c0" }}
        >
          {error}
        </div>
      )}

      {!topics ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-[12px] bg-[var(--hairline-soft)] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[14px] text-[var(--muted)] py-12 text-center">
          No topics in this filter.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((topic) => (
            <li key={topic.id}>
              <Link
                href={`/admin/topics/${topic.id}`}
                className="voices-card voices-card-hover block p-5"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="shrink-0 w-12 h-12 rounded-[8px] flex flex-col items-center justify-center"
                    style={{ background: "var(--accent-soft)" }}
                  >
                    <span className="voices-eyebrow text-[9px]">WK</span>
                    <span
                      className="voices-mono text-[15px] font-semibold leading-none"
                      style={{ color: "var(--ink)" }}
                    >
                      {String(topic.week).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {statusPill(topic.status)}
                      <Pill variant="ghost">{topic.category.toUpperCase()}</Pill>
                      <span className="voices-eyebrow">
                        {topic._count.clusters} CLUSTERS · {topic._count.takes} TAKES
                      </span>
                    </div>
                    <h2
                      className="text-[16px] font-semibold text-[var(--ink)] leading-snug bn-text"
                      style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
                    >
                      {topic.question}
                    </h2>
                    {topic.questionEn && (
                      <p className="text-[13px] italic text-[var(--ink-soft)] mt-0.5">
                        {topic.questionEn}
                      </p>
                    )}
                  </div>

                  <span className="voices-eyebrow shrink-0 self-center">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
