"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import { useCurrentUser } from "@/lib/user-context";

export function Navbar() {
  const { locale, msgs, setLocale } = useLocale();
  const { user } = useCurrentUser();

  return (
    <nav
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{
        backgroundColor: "color-mix(in srgb, var(--paper) 88%, transparent)",
        borderColor: "var(--hairline)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Wordmark + tagline */}
        <Link href="/" className="flex items-center gap-2.5 no-underline group">
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-[8px] text-white text-lg shrink-0"
            style={{
              backgroundColor: "var(--ink)",
              fontFamily: "Newsreader, Georgia, serif",
              fontWeight: 500,
              lineHeight: 1,
            }}
          >
            V
          </span>
          <span
            className="voices-serif"
            style={{
              color: "var(--ink)",
              fontWeight: 500,
              fontSize: "20px",
              letterSpacing: "-0.015em",
              lineHeight: 1,
            }}
          >
            Voices
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/results"
            className="px-3 py-1.5 rounded-[8px] text-sm font-medium hover:bg-[var(--accent-soft)] transition-colors"
            style={{ color: "var(--ink-soft)" }}
          >
            {msgs.nav.results}
          </Link>
          <Link
            href="/past"
            className="px-3 py-1.5 rounded-[8px] text-sm font-medium hover:bg-[var(--accent-soft)] transition-colors"
            style={{ color: "var(--ink-soft)" }}
          >
            {msgs.nav.past}
          </Link>

          {user?.isAdmin && (
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-[8px] text-sm font-medium hover:bg-[var(--accent-soft)] transition-colors voices-mono"
              style={{ color: "var(--ink-soft)", letterSpacing: "0.04em" }}
            >
              ADMIN
            </Link>
          )}

          {/* Locale toggle */}
          <button
            onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
            className="ml-1 px-2.5 py-1 rounded-[6px] text-xs font-semibold border transition-all hover:bg-[var(--accent-soft)]"
            style={{
              fontFamily: "JetBrains Mono, monospace",
              borderColor: "var(--hairline)",
              color: "var(--ink-soft)",
              letterSpacing: "0.05em",
            }}
          >
            {locale === "bn" ? "EN" : "বাং"}
          </button>
        </div>
      </div>
    </nav>
  );
}
