"use client";

import { useLocale } from "@/lib/locale-context";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";

interface TopicHeroProps {
  id: string;
  week: number;
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
  category: string;
}

export function TopicHero({
  id,
  week,
  question,
  questionEn,
  context,
  image,
  closesAt,
  status,
  category,
}: TopicHeroProps) {
  const { locale, msgs } = useLocale();
  const closesDate = new Date(closesAt);
  const timeLeft = formatDistanceToNow(closesDate, { addSuffix: true });
  const isClosed = status === "closed";

  const categoryLabels: Record<string, string> = msgs.categories;

  const headline = locale === "en" && questionEn ? questionEn : question;
  const headlineClass = locale === "en" && questionEn ? "voices-display" : "voices-display-bn";

  return (
    <section className="pt-4 pb-3 px-4 max-w-[430px] mx-auto">
      {image && (
        <figure className="mb-3">
          <div
            className="relative aspect-[16/9] overflow-hidden rounded-[8px] border bg-[var(--surface-soft)]"
            style={{
              borderColor: "var(--hairline)",
              backgroundColor: image.color ?? "var(--surface-soft)",
            }}
          >
            <img
              src={image.url}
              alt={image.alt}
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
        </figure>
      )}

      {/* Eyebrow row */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
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
        className={`${headlineClass} text-[22px] sm:text-3xl text-[var(--ink)] mb-2`}
      >
        {headline}
      </h1>

      {/* Context — set in italic Newsreader for English, in serif Bangla otherwise */}
      {context && (
        <p
          className="text-[13px] text-[var(--ink-soft)] leading-snug mb-3 max-w-2xl bn-text line-clamp-2"
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
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-[var(--muted)]">
          {isClosed ? msgs.topic.closed : `${timeLeft}`}
        </span>
        <Link href={`/results?topicId=${id}`} className="voices-eyebrow hover:text-[var(--ink)]">
          {msgs.topic.viewTally}
        </Link>
      </div>
    </section>
  );
}
