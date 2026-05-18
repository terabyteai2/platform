"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { useCurrentUser } from "@/lib/user-context";
import { Icon } from "@/components/ui/Icon";
import clsx from "clsx";

export function Navbar() {
  const { locale, setLocale } = useLocale();
  const { user, openEditor } = useCurrentUser();
  const pathname = usePathname();
  const navItems = [
    { href: "/", label: "Today", icon: Icon.Home, active: pathname === "/" },
    { href: "/past", label: "Past", icon: Icon.Clock, active: pathname.startsWith("/past") },
  ];

  return (
    <>
      <nav
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          backgroundColor: "color-mix(in srgb, var(--paper) 92%, transparent)",
          borderColor: "var(--hairline)",
        }}
      >
        <div className="max-w-[430px] mx-auto px-4 h-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 no-underline group">
            <span
              className="voices-serif"
              style={{
                color: "var(--ink)",
                fontWeight: 600,
                fontSize: "17px",
                letterSpacing: "-0.015em",
                lineHeight: 1,
              }}
            >
              Voices
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 voices-mono text-[9px] font-semibold text-[var(--live)] border-[var(--hairline)] bg-[var(--surface)]">
              <span className="voices-live-dot" />
              LIVE
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            {user?.isAdmin && (
              <Link
                href="/admin"
                className="px-2 py-1 rounded-full text-[10px] font-semibold border voices-mono bg-[var(--surface)] border-[var(--hairline)]"
                style={{ color: "var(--ink-soft)", letterSpacing: "0.04em" }}
              >
                ADMIN
              </Link>
            )}
            <button
              onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
              className="px-2 py-1 rounded-full text-[10px] font-semibold border transition-all hover:bg-[var(--accent-soft)] bg-[var(--surface)]"
              style={{
                fontFamily: "JetBrains Mono, monospace",
                borderColor: "var(--hairline)",
                color: "var(--ink-soft)",
                letterSpacing: "0.05em",
              }}
            >
              {locale === "bn" ? "EN" : "বাং"}
            </button>
            <button
              onClick={openEditor}
              className="px-2 py-1 rounded-full text-[10px] font-semibold border voices-mono bg-[var(--surface)]"
              style={{
                borderColor: "var(--hairline)",
                color: "var(--ink-soft)",
                letterSpacing: "0.05em",
              }}
            >
              {user?.displayName ? user.displayName.slice(0, 8).toUpperCase() : "ANON"}
            </button>
          </div>
        </div>
      </nav>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{ background: "var(--paper)", borderColor: "var(--hairline)" }}
        aria-label="Primary"
      >
        <div className="max-w-[430px] mx-auto h-14 px-8 grid grid-cols-3 items-center">
          {navItems.map((item) => {
            const Glyph = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold",
                  item.active ? "text-[var(--ink)]" : "text-[var(--muted)]"
                )}
              >
                <Glyph size={16} sw={2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={openEditor}
            className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-[var(--muted)]"
          >
            <Icon.User size={16} sw={2} />
            <span>You</span>
          </button>
        </div>
      </nav>
    </>
  );
}
