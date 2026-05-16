"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import Link from "next/link";
import { format } from "date-fns";

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

const categories: { key: Category; label: string }[] = [
  { key: null, label: "সব" },
  { key: "work", label: "কাজ" },
  { key: "tech", label: "প্রযুক্তি" },
  { key: "society", label: "সমাজ" },
  { key: "cities", label: "শহর" },
  { key: "local", label: "স্থানীয়" },
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-16">
      <h1
        className="text-2xl font-semibold text-[#14110d] mb-6"
        style={{ fontFamily: "Noto Serif Bengali, Georgia, serif" }}
      >
        {msgs.past.title}
      </h1>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((c) => (
          <button
            key={String(c.key)}
            onClick={() => setCat(c.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              cat === c.key
                ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                : "bg-white text-[#3a342c] border-[#e2ddd1] hover:border-[#1a1a1a]"
            }`}
          >
            {locale === "en"
              ? { work: "Work", tech: "Tech", society: "Society", cities: "Cities", local: "Local", null: "All" }[String(c.key)]
              : c.label}
          </button>
        ))}
      </div>

      {/* Topic grid */}
      {topics.length === 0 && !loading ? (
        <p className="text-[#7a7163] text-sm">কোনো পুরোনো আলোচনা নেই।</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map((t) => (
            <Link
              key={t.id}
              href={`/results?topicId=${t.id}`}
              className="block rounded-[12px] border border-[#e2ddd1] bg-white p-4 hover:border-[#1a1a1a] transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs text-[#7a7163]"
                  style={{ fontFamily: "JetBrains Mono, monospace" }}
                >
                  সপ্তাহ {t.week}
                </span>
                <span
                  className="text-xs text-[#7a7163] px-1.5 py-0.5 rounded-full bg-[#f5f2ec]"
                  style={{ fontFamily: "JetBrains Mono, monospace" }}
                >
                  {t.category}
                </span>
              </div>
              <h2
                className="text-sm font-semibold text-[#14110d] leading-snug mb-2 bn-text group-hover:underline underline-offset-2"
                style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
              >
                {locale === "en" && t.questionEn ? t.questionEn : t.question}
              </h2>
              <div className="flex flex-wrap gap-1 mb-3">
                {t.topClusters.slice(0, 2).map((c) => (
                  <span
                    key={c.id}
                    className="text-xs px-2 py-0.5 rounded-full bg-[#f5f2ec] text-[#7a7163] border border-[#e2ddd1]"
                  >
                    {c.label}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-[#7a7163]">
                <span style={{ fontFamily: "JetBrains Mono, monospace" }}>
                  {t.totalTakes} মতামত
                </span>
                <span>{format(new Date(t.closesAt), "MMM d, yyyy")}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-[12px] bg-[#e2ddd1] animate-pulse" />
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-8 text-center">
          <button
            onClick={() => load(cat, cursor)}
            className="px-6 py-2.5 rounded-[6px] border border-[#e2ddd1] text-sm font-medium text-[#3a342c] hover:bg-[#ececec] transition-colors"
          >
            {msgs.past.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
