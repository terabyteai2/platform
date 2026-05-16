"use client";

import { useLocale } from "@/lib/locale-context";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";

interface TopicHeroProps {
  id: string;
  week: number;
  question: string;
  questionEn?: string | null;
  context?: string | null;
  closesAt: string;
  status: string;
  totalTakes: number;
  category: string;
}

export function TopicHero({
  id,
  week,
  question,
  questionEn,
  context,
  closesAt,
  status,
  totalTakes,
  category,
}: TopicHeroProps) {
  const { locale, msgs } = useLocale();
  const closesDate = new Date(closesAt);
  const timeLeft = formatDistanceToNow(closesDate, { addSuffix: true });
  const isClosed = status === "closed";

  const categoryLabels: Record<string, string> = {
    work: locale === "bn" ? "কাজ" : "Work",
    tech: locale === "bn" ? "প্রযুক্তি" : "Tech",
    society: locale === "bn" ? "সমাজ" : "Society",
    cities: locale === "bn" ? "শহর" : "Cities",
    local: locale === "bn" ? "স্থানীয়" : "Local",
  };

  return (
    <section className="pt-8 pb-6 px-4 sm:px-6 max-w-3xl mx-auto">
      {/* Week + category + status */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#ececec] text-[#3a342c]"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {msgs.topic.week} {week}
        </span>
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full border border-[#e2ddd1] text-[#7a7163]"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {categoryLabels[category] ?? category}
        </span>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            isClosed
              ? "bg-[#f5f2ec] text-[#7a7163] border border-[#e2ddd1]"
              : "bg-[#edfbef] text-[#2d6a30] border border-[#c4dfc5]"
          }`}
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {isClosed ? msgs.topic.closed : "● " + msgs.topic.live}
        </span>
      </div>

      {/* Question */}
      <h1
        className="text-2xl sm:text-3xl font-semibold text-[#14110d] leading-tight mb-3 bn-serif"
        style={{ fontFamily: "Noto Serif Bengali, Georgia, serif" }}
      >
        {locale === "en" && questionEn ? questionEn : question}
      </h1>

      {/* Context */}
      {context && (
        <p
          className="text-sm text-[#3a342c] leading-relaxed mb-4 bn-text max-w-2xl"
          style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
        >
          {context}
        </p>
      )}

      {/* Stats + CTA row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className="text-2xl font-bold text-[#14110d]"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {totalTakes.toLocaleString()}
          </span>
          <span className="text-sm text-[#7a7163]">{msgs.topic.totalVoices}</span>
          <span className="text-[#e2ddd1]">·</span>
          <span className="text-sm text-[#7a7163]">
            {isClosed ? msgs.topic.closed : `${msgs.topic.closesAt} ${timeLeft}`}
          </span>
        </div>

        {!isClosed && (
          <Link href={`/record?topicId=${id}`}>
            <Btn size="md" variant="primary">
              {msgs.topic.addVoice}
            </Btn>
          </Link>
        )}
      </div>
    </section>
  );
}
