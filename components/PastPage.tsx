"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import Link from "next/link";
import { format } from "date-fns";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/ui/Icon";
import clsx from "clsx";

type Category = "work" | "tech" | "society" | "cities" | "local" | null;

interface PastTopic {
  id: string;
  week: number;
  category: string;
  question: string;
  questionEn?: string | null;
  closesAt: string;
  totalTakes: number;
  topClusters: Array<{ id: string; label: string }>;
}

const categories: { key: Category; label: string; labelEn: string }[] = [
  { key: null, label: "সব", labelEn: "All" },
  { key: "work", label: "কাজ", labelEn: "Work" },
  { key: "tech", label: "প্রযুক্তি", labelEn: "Tech" },
  { key: "society", label: "সমাজ", labelEn: "Society" },
  { key: "cities", label: "শহর", labelEn: "Cities" },
  { key: "local", label: "স্থানীয়", labelEn: "Local" },
];

export function PastPage() {
  const { locale, msgs } = useLocale();
  const [topics, setTopics] = useState<PastTopic[]>([]);
  const [cat, setCat] = useState<Category>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(category: Category, cursorVal: string | null, reset = false) {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("cat", category);
    if (cursorVal) params.set("cursor", cursorVal);

    const res = await fetch(`/api/topics/past?${params}`);
    const data = await res.json();
    setTopics((prev) => (reset ? data.topics : [...prev, ...data.topics]));
    setCursor(data.nextCursor);
    setHasMore(!!data.nextCursor);
    setLoading(false);
  }

  useEffect(() => {
    load(cat, null, true);
  }, [cat]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-16">
      {/* Header */}
      <div className="mb-8">
        <span className="voices-eyebrow">ARCHIVE</span>
        <h1 className="mt-2 voices-display text-4xl sm:text-5xl text-[var(--ink)]">
          {msgs.past.title}
        </h1>
        <p
          className="mt-3 voices-quote text-lg text-[var(--muted)]"
          style={{ fontFamily: "Newsreader, Georgia, serif", fontStyle: "italic" }}
        >
          One question a week. The conversations live here.
        </p>
        <hr className="voices-rule mt-6" />
      </div>

      {/* Category filter — pill row */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((c) => {
          const selected = cat === c.key;
          return (
            <button
              key={String(c.key)}
              onClick={() => setCat(c.key)}
              className={clsx(
                "inline-flex items-center px-3 py-1.5 text-[12px] font-semibold rounded-[var(--r-pill)] border voices-mono transition-all",
                selected
                  ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                  : "bg-[var(--surface)] text-[var(--ink-soft)] border-[var(--hairline)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]"
              )}
              style={{ letterSpacing: "0.06em" }}
            >
              {(locale === "en" ? c.labelEn : c.label).toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Topic grid */}
      {topics.length === 0 && !loading ? (
        <div className="text-center py-12 voices-card">
          <span className="voices-eyebrow block mb-2">EMPTY</span>
          <p className="text-[var(--muted)] text-sm bn-text">
            কোনো পুরোনো আলোচনা নেই।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {topics.map((t) => (
            <Link
              key={t.id}
              href={`/results?topicId=${t.id}`}
              className="voices-card voices-card-hover p-5 flex flex-col gap-3 no-underline group"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Pill variant="default">
                  WEEK {t.week.toString().padStart(2, "0")}
                </Pill>
                <Pill variant="ghost">{t.category.toUpperCase()}</Pill>
              </div>
              <h2
                className="text-[18px] sm:text-[19px] font-semibold leading-snug bn-text text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors"
                style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
              >
                {locale === "en" && t.questionEn ? t.questionEn : t.question}
              </h2>
              {t.topClusters.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {t.topClusters.slice(0, 2).map((c) => (
                    <span
                      key={c.id}
                      className="voices-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[var(--r-pill)] border"
                      style={{
                        color: "var(--muted)",
                        borderColor: "var(--hairline-soft)",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              )}
              <div
                className="pt-3 mt-1 border-t flex items-center justify-between"
                style={{ borderColor: "var(--hairline-soft)" }}
              >
                <span className="voices-eyebrow">
                  {t.totalTakes.toLocaleString()} VOICES
                </span>
                <span className="voices-mono text-[11px]" style={{ color: "var(--muted)" }}>
                  {format(new Date(t.closesAt), "MMM d, yyyy")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 rounded-[var(--r-lg)] bg-[var(--hairline-soft)] animate-pulse" />
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-10 text-center">
          <button
            onClick={() => load(cat, cursor)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] border voices-mono text-[12px] font-semibold transition-colors hover:bg-[var(--accent-soft)]"
            style={{
              borderColor: "var(--hairline)",
              color: "var(--ink-soft)",
              letterSpacing: "0.08em",
            }}
          >
            <Icon.Plus size={12} sw={2.4} />
            {msgs.past.loadMore.toUpperCase()}
          </button>
        </div>
      )}
    </div>
  );
}
