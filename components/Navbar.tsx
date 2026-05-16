"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";

export function Navbar() {
  const { locale, msgs, setLocale } = useLocale();

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--hairline)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2 no-underline"
        >
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-[6px] text-white text-base font-semibold"
            style={{ backgroundColor: "var(--ink)", fontFamily: "Newsreader, Georgia, serif" }}
          >
            V
          </span>
          <span
            className="font-semibold text-base tracking-tight"
            style={{ color: "var(--ink)", fontFamily: "Newsreader, Georgia, serif" }}
          >
            Voices
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/results"
            className="px-3 py-1.5 rounded-[6px] text-sm font-medium hover:bg-[#ececec] transition-colors"
            style={{ color: "var(--ink-soft)" }}
          >
            {msgs.nav.results}
          </Link>
          <Link
            href="/past"
            className="px-3 py-1.5 rounded-[6px] text-sm font-medium hover:bg-[#ececec] transition-colors"
            style={{ color: "var(--ink-soft)" }}
          >
            {msgs.nav.past}
          </Link>

          {/* Locale toggle */}
          <button
            onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
            className="ml-1 px-2.5 py-1 rounded-[6px] text-xs font-medium border transition-all hover:bg-[#ececec]"
            style={{
              fontFamily: "JetBrains Mono, monospace",
              borderColor: "var(--hairline)",
              color: "var(--muted)",
            }}
          >
            {locale === "bn" ? "EN" : "বাং"}
          </button>
        </div>
      </div>
    </nav>
  );
}
