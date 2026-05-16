"use client";

import { useEffect, useState } from "react";
import { Btn } from "@/components/ui/Btn";
import { ConfidenceChip } from "@/components/ui/ConfidenceChip";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/ui/Icon";
import { format } from "date-fns";
import clsx from "clsx";

interface FlaggedTake {
  id: string;
  content: string;
  audioUrl?: string | null;
  asrConfidence?: number | null;
  moderationReason?: string | null;
  isHidden: boolean;
  createdAt: string;
  cluster?: { label: string } | null;
  user: { displayName?: string | null; isAnon: boolean };
}

interface PendingCluster {
  id: string;
  label: string;
  summary?: string | null;
  _count: { takes: number };
  topic: { question: string };
}

export function AdminQueuePage() {
  const [flagged, setFlagged] = useState<FlaggedTake[]>([]);
  const [pendingClusters, setPendingClusters] = useState<PendingCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"flagged" | "clusters">("flagged");

  useEffect(() => {
    fetch("/api/admin/queue")
      .then((r) => r.json())
      .then((d) => {
        setFlagged(d.flagged ?? []);
        setPendingClusters(d.pendingClusters ?? []);
        setLoading(false);
      });
  }, []);

  async function action(takeId: string, act: "approve" | "hide" | "dismiss") {
    await fetch(`/api/admin/takes/${takeId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act }),
    });
    setFlagged((prev) => prev.filter((t) => t.id !== takeId));
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-16">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Pill variant="default">ADMIN</Pill>
          <Pill variant="live" icon={<span className="voices-live-dot" />}>QUEUE</Pill>
        </div>
        <h1 className="voices-display text-4xl sm:text-5xl text-[var(--ink)]">
          মডারেশন কিউ
        </h1>
        <p
          className="mt-3 voices-quote text-lg text-[var(--muted)]"
          style={{ fontFamily: "Newsreader, Georgia, serif", fontStyle: "italic" }}
        >
          Flagged voices and emerging clusters waiting on your call.
        </p>
        <hr className="voices-rule mt-6" />
      </div>

      {/* Tabs */}
      <div
        className="flex gap-0 mb-8 border-b"
        style={{ borderColor: "var(--hairline)" }}
      >
        {(
          [
            { key: "flagged", label: `FLAGGED · ${String(flagged.length).padStart(2, "0")}` },
            { key: "clusters", label: `NEW CLUSTERS · ${String(pendingClusters.length).padStart(2, "0")}` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "voices-mono text-[11px] font-semibold px-4 py-3 border-b-2 transition-colors",
              tab === t.key
                ? "border-[var(--accent)] text-[var(--ink)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--ink-soft)]"
            )}
            style={{ letterSpacing: "0.1em" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-[var(--r-lg)] bg-[var(--hairline-soft)] animate-pulse" />
          ))}
        </div>
      )}

      {/* Flagged takes */}
      {tab === "flagged" && !loading && (
        <div className="space-y-4">
          {flagged.length === 0 ? (
            <div className="voices-card p-10 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--accent-soft)] mx-auto mb-3">
                <Icon.Check size={22} color="var(--accent)" sw={2.2} />
              </div>
              <span className="voices-eyebrow block mb-1">QUEUE CLEAR</span>
              <p className="text-[var(--muted)] text-sm bn-text">কোনো ফ্ল্যাগড মতামত নেই।</p>
            </div>
          ) : (
            flagged.map((take) => (
              <div key={take.id} className="voices-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {take.cluster && <Pill variant="default">{take.cluster.label}</Pill>}
                      {take.user.isAnon ? (
                        <Pill variant="ghost">ANON</Pill>
                      ) : (
                        <Pill variant="ghost">{(take.user.displayName ?? "USER").toUpperCase()}</Pill>
                      )}
                    </div>
                    <p
                      className="text-[15px] text-[var(--ink)] leading-relaxed bn-text"
                      style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                    >
                      {take.content}
                    </p>
                    {take.moderationReason && (
                      <div className="flex items-start gap-2 text-[12px] rounded-[8px] px-3 py-2"
                        style={{ background: "#fff4ef", color: "var(--warn)", border: "1px solid #f5d4c0" }}
                      >
                        <Icon.Warn size={12} sw={2} />
                        <span>{take.moderationReason}</span>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {take.asrConfidence != null && <ConfidenceChip confidence={take.asrConfidence} />}
                    <span className="voices-mono text-[10px]" style={{ color: "var(--muted)" }}>
                      {format(new Date(take.createdAt), "MMM d · HH:mm")}
                    </span>
                  </div>
                </div>

                {take.audioUrl && (
                  <audio controls src={take.audioUrl} className="w-full" />
                )}

                <div
                  className="flex flex-wrap gap-2 pt-3 border-t"
                  style={{ borderColor: "var(--hairline-soft)" }}
                >
                  <Btn size="sm" variant="accent" onClick={() => action(take.id, "approve")}>
                    <Icon.Check size={12} sw={2.2} />
                    অনুমোদন
                  </Btn>
                  <Btn size="sm" variant="secondary" onClick={() => action(take.id, "hide")}>
                    লুকান
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => action(take.id, "dismiss")}>
                    বাতিল
                  </Btn>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pending clusters */}
      {tab === "clusters" && !loading && (
        <div className="space-y-3">
          {pendingClusters.length === 0 ? (
            <div className="voices-card p-10 text-center">
              <span className="voices-eyebrow block mb-1">NO PENDING CLUSTERS</span>
              <p className="text-[var(--muted)] text-sm bn-text">কোনো নতুন ক্লাস্টার নেই।</p>
            </div>
          ) : (
            pendingClusters.map((c, idx) => (
              <div key={c.id} className="voices-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span
                      className="voices-mono text-[11px] font-semibold shrink-0 mt-1"
                      style={{ color: "var(--muted)", letterSpacing: "0.08em" }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[16px] font-semibold text-[var(--ink)] bn-text leading-snug"
                        style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                      >
                        {c.label}
                      </p>
                      {c.summary && (
                        <p
                          className="text-[13px] text-[var(--muted)] mt-1 bn-text leading-relaxed"
                          style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                        >
                          {c.summary}
                        </p>
                      )}
                      <p className="voices-eyebrow mt-2">
                        FROM: {c.topic.question.slice(0, 50)}…
                      </p>
                    </div>
                  </div>
                  <Pill variant="ai" icon={<Icon.Sparkle size={10} color="#fff" sw={2.5} />}>
                    {c._count.takes}/5
                  </Pill>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
