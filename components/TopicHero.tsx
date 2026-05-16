"use client";

import { useLocale } from "@/lib/locale-context";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";
import { Pill } from "@/components/ui/Pill";

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

  const headline = locale === "en" && questionEn ? questionEn : question;
  const headlineClass = locale === "en" && questionEn ? "voices-display" : "voices-display-bn";

  return (
    <section className="pt-12 pb-8 px-4 sm:px-6 max-w-3xl mx-auto">
      {/* Eyebrow row */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Pill variant="default">
          {msgs.topic.week.toUpperCase()} {week.toString().padStart(2, "0")}
        </Pill>
        <Pill variant="default">{(categoryLabels[category] ?? category).toUpperCase()}</Pill>
        {isClosed ? (
          <Pill variant="ghost">{msgs.topic.closed.toUpperCase()}</Pill>
        ) : (
          <Pill variant="live" icon={<span className="voices-live-dot" />}>
            {msgs.topic.live.toUpperCase()}
          </Pill>
        )}
      </div>

      {/* Headline */}
      <h1
        className={`${headlineClass} text-4xl sm:text-5xl text-[var(--ink)] mb-5`}
      >
        {headline}
      </h1>

      {/* Context — set in italic Newsreader for English, in serif Bangla otherwise */}
      {context && (
        <p
          className="text-[17px] sm:text-lg text-[var(--ink-soft)] leading-relaxed mb-7 max-w-2xl bn-text"
          style={{
            fontFamily: locale === "en"
              ? "Newsreader, Georgia, serif"
              : "Noto Serif Bengali, Newsreader, Georgia, serif",
            fontStyle: locale === "en" ? "italic" : "normal",
            fontWeight: 400,
          }}
        >
          {context}
        </p>
      )}

      {/* Decorative hairline */}
      <hr className="voices-rule mb-5" />

      {/* Stats + CTA row */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="flex items-baseline gap-3">
          <span
            className="voices-mono text-3xl sm:text-4xl font-semibold text-[var(--ink)]"
            style={{ letterSpacing: "-0.02em" }}
          >
            {totalTakes.toLocaleString()}
          </span>
          <div className="flex flex-col leading-tight">
            <span className="voices-eyebrow">{msgs.topic.totalVoices.toUpperCase()}</span>
            <span className="text-[13px] text-[var(--muted)] mt-0.5">
              {isClosed ? msgs.topic.closed : `${msgs.topic.closesAt} ${timeLeft}`}
            </span>
          </div>
        </div>

        {!isClosed && (
          <Link href={`/record?topicId=${id}`}>
            <Btn size="md" variant="accent">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              {msgs.topic.addVoice}
            </Btn>
          </Link>
        )}
      </div>
    </section>
  );
}
