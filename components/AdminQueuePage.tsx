"use client";

import { useEffect, useState } from "react";
import { Btn } from "@/components/ui/Btn";
import { ConfidenceChip } from "@/components/ui/ConfidenceChip";
import { format } from "date-fns";

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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-16">
      <h1
        className="text-2xl font-semibold text-[#14110d] mb-6"
        style={{ fontFamily: "Noto Serif Bengali, Georgia, serif" }}
      >
        মডারেশন কিউ
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#e2ddd1]">
        {(["flagged", "clusters"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-[#1a1a1a] text-[#14110d]"
                : "border-transparent text-[#7a7163] hover:text-[#3a342c]"
            }`}
          >
            {t === "flagged" ? `ফ্ল্যাগড (${flagged.length})` : `নতুন ক্লাস্টার (${pendingClusters.length})`}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-[12px] bg-[#e2ddd1] animate-pulse" />)}
        </div>
      )}

      {/* Flagged takes */}
      {tab === "flagged" && !loading && (
        <div className="space-y-4">
          {flagged.length === 0 ? (
            <p className="text-[#7a7163] text-sm">কোনো ফ্ল্যাগড মতামত নেই। ✓</p>
          ) : (
            flagged.map((take) => (
              <div
                key={take.id}
                className="rounded-[12px] border border-[#e2ddd1] bg-white p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    {take.cluster && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5f2ec] text-[#7a7163] border border-[#e2ddd1]">
                        {take.cluster.label}
                      </span>
                    )}
                    <p
                      className="text-sm text-[#14110d] leading-relaxed bn-text"
                      style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                    >
                      {take.content}
                    </p>
                    {take.moderationReason && (
                      <p className="text-xs text-[#b85c1e] bg-[#fff4ef] rounded px-2 py-1">
                        ⚠ {take.moderationReason}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 space-y-1 text-right">
                    {take.asrConfidence != null && (
                      <ConfidenceChip confidence={take.asrConfidence} />
                    )}
                    <p className="text-xs text-[#7a7163]">
                      {format(new Date(take.createdAt), "MMM d, HH:mm")}
                    </p>
                  </div>
                </div>

                {take.audioUrl && (
                  <audio controls src={take.audioUrl} className="w-full" />
                )}

                <div className="flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => action(take.id, "approve")}>
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
        <div className="space-y-4">
          {pendingClusters.length === 0 ? (
            <p className="text-[#7a7163] text-sm">কোনো নতুন ক্লাস্টার নেই।</p>
          ) : (
            pendingClusters.map((c) => (
              <div
                key={c.id}
                className="rounded-[12px] border border-[#e2ddd1] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p
                      className="text-sm font-semibold text-[#14110d] bn-text"
                      style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                    >
                      {c.label}
                    </p>
                    {c.summary && (
                      <p className="text-xs text-[#7a7163] mt-0.5">{c.summary}</p>
                    )}
                    <p className="text-xs text-[#7a7163] mt-1">
                      {c._count.takes} মতামত · {c.topic.question.slice(0, 60)}...
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full bg-[#f5f2ec] text-[#7a7163]"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                  >
                    {c._count.takes}/5
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
