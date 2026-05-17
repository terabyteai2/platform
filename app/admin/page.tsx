import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Pill } from "@/components/ui/Pill";

export default async function AdminIndex() {
  if (!(await isAdmin())) {
    redirect("/");
  }

  const tiles = [
    {
      href: "/admin/topics",
      title: "Topics",
      description: "Browse, edit, publish, or delete every topic. Manage clusters and takes inside each one.",
      kbd: "01",
    },
    {
      href: "/admin/compose",
      title: "Compose",
      description: "Create a new topic from scratch. AI-seed clusters, set the hero image, and publish.",
      kbd: "02",
    },
    {
      href: "/admin/queue",
      title: "Moderation queue",
      description: "Review flagged takes and pending user-created clusters.",
      kbd: "03",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-16">
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Pill variant="default">ADMIN</Pill>
        </div>
        <h1 className="voices-display text-4xl sm:text-5xl text-[var(--ink)]">
          Admin
        </h1>
        <p
          className="mt-3 voices-quote text-lg text-[var(--muted)]"
          style={{ fontFamily: "Newsreader, Georgia, serif", fontStyle: "italic" }}
        >
          Everything you need to curate Voices.
        </p>
        <hr className="voices-rule mt-6" />
      </div>

      <ul className="space-y-3">
        {tiles.map((tile) => (
          <li key={tile.href}>
            <Link
              href={tile.href}
              className="voices-card voices-card-hover block p-6"
            >
              <div className="flex items-start gap-4">
                <div
                  className="shrink-0 w-9 h-9 rounded-[8px] flex items-center justify-center voices-mono text-[12px] font-semibold"
                  style={{ background: "var(--accent-soft)", color: "var(--ink)" }}
                >
                  {tile.kbd}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[18px] font-semibold text-[var(--ink)] leading-snug">
                    {tile.title}
                  </h2>
                  <p className="mt-1 text-[14px] text-[var(--ink-soft)] leading-relaxed">
                    {tile.description}
                  </p>
                </div>
                <span className="voices-eyebrow shrink-0 self-center">→</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
