"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { Btn } from "@/components/ui/Btn";
import { ConfidenceChip } from "@/components/ui/ConfidenceChip";
import { Pill } from "@/components/ui/Pill";
import clsx from "clsx";

interface TakeData {
  id: string;
  content: string;
  asrConfidence?: number | null;
  clusterId?: string | null;
  aiSuggestedClusterId?: string | null;
  aiMatchScore?: number | null;
  topicId: string;
  cluster?: { id: string; label: string } | null;
}

interface ClusterInfo {
  id: string;
  label: string;
}

export function ReviewFlow() {
  const { msgs } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const takeId = searchParams.get("takeId");

  const [take, setTake] = useState<TakeData | null>(null);
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [content, setContent] = useState("");
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [showNewCluster, setShowNewCluster] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [isAnon, setIsAnon] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ published: boolean; pending?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!takeId) return;
    fetch(`/api/takes/${takeId}`)
      .then((r) => r.json())
      .then((d) => {
        const t = d.take as TakeData;
        setTake(t);
        setContent(t.content);
        setSelectedClusterId(t.aiSuggestedClusterId ?? t.clusterId ?? null);
        // Fetch topic clusters
        return fetch(`/api/topics/${t.topicId}`);
      })
      .then((r) => r.json())
      .then((d) => {
        setClusters(d.topic?.clusters?.map((c: ClusterInfo) => ({ id: c.id, label: c.label })) ?? []);
      });
  }, [takeId]);

  async function handleConfirm() {
    if (!takeId || !take) return;
    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      content,
      isAnon,
    };

    if (showNewCluster && newLabel.trim()) {
      body.newClusterLabel = newLabel.trim();
    } else if (selectedClusterId) {
      body.clusterId = selectedClusterId;
    }

    const res = await fetch(`/api/takes/${takeId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setSubmitting(false);

    if (res.status === 422) {
      setError(msgs.errors.flagged);
      return;
    }
    if (!res.ok) {
      setError(msgs.errors.generic);
      return;
    }

    setDone(data);
  }

  if (!take) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-12 text-center">
        <p className="text-[#7a7163]">লোড হচ্ছে...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-16 text-center space-y-4">
        <div className="text-4xl">✓</div>
        <h2
          className="text-xl font-semibold text-[#14110d] bn-text"
          style={{ fontFamily: "Hind Siliguri, sans-serif" }}
        >
          {done.pending ? msgs.review.pending : "প্রকাশিত হয়েছে!"}
        </h2>
        <p className="text-sm text-[#7a7163] bn-text" style={{ fontFamily: "Hind Siliguri, sans-serif" }}>
          {done.pending ? msgs.review.pendingDesc : "আপনার মতামত যোগ হয়েছে।"}
        </p>
        <Btn onClick={() => router.push("/")} variant="secondary" size="md">
          ← হোমে ফিরুন
        </Btn>
      </div>
    );
  }

  const isLowConfidence = (take.asrConfidence ?? 1) < 0.7;

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 pt-8 pb-16 space-y-6">
      <h1
        className="text-xl font-semibold text-[#14110d] bn-text"
        style={{ fontFamily: "Hind Siliguri, sans-serif" }}
      >
        {msgs.review.title}
      </h1>

      {/* Transcript */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[#3a342c]">{msgs.review.transcript}</h2>
          {take.asrConfidence != null && (
            <ConfidenceChip confidence={take.asrConfidence} />
          )}
        </div>
        {isLowConfidence && (
          <p className="text-xs text-[#b85c1e] bg-[#fff4ef] rounded-[6px] px-3 py-2 border border-[#f5d4c0]">
            ⚠ {msgs.review.lowConfidence}
          </p>
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={clsx(
            "w-full min-h-[120px] p-3 rounded-[6px] border text-sm leading-relaxed",
            "resize-y focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] focus:ring-offset-1",
            "bg-white text-[#14110d] border-[#e2ddd1] placeholder:text-[#7a7163]"
          )}
          style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
          placeholder={msgs.review.editHint}
        />
      </section>

      {/* Cluster selection */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[#3a342c]">{msgs.review.aiCluster}</h2>

        {!showNewCluster ? (
          <div className="flex flex-wrap gap-2">
            {clusters.map((c) => (
              <Pill
                key={c.id}
                label={c.label}
                selected={selectedClusterId === c.id}
                onClick={() => {
                  setSelectedClusterId(c.id);
                  setShowNewCluster(false);
                }}
              />
            ))}
            <button
              onClick={() => {
                setShowNewCluster(true);
                setSelectedClusterId(null);
              }}
              className="text-sm text-[#7a7163] hover:text-[#3a342c] underline underline-offset-2 px-1 py-0.5"
            >
              + {msgs.review.newCluster}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="নতুন ক্লাস্টারের নাম লিখুন..."
              maxLength={80}
              className={clsx(
                "w-full p-3 rounded-[6px] border text-sm",
                "focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]",
                "bg-white text-[#14110d] border-[#e2ddd1]"
              )}
              style={{ fontFamily: "Hind Siliguri, sans-serif" }}
            />
            <button
              onClick={() => setShowNewCluster(false)}
              className="text-xs text-[#7a7163] hover:text-[#3a342c] underline underline-offset-2"
            >
              {msgs.review.switchCluster}
            </button>
          </div>
        )}
      </section>

      {/* Identity */}
      <section className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isAnon}
            onChange={(e) => setIsAnon(e.target.checked)}
            className="w-4 h-4 rounded border-[#e2ddd1]"
          />
          <span className="text-sm text-[#3a342c]">{msgs.review.anonymous}</span>
        </label>
      </section>

      {error && (
        <p className="text-sm text-[#b85c1e] bg-[#fff4ef] rounded-[6px] px-3 py-2">
          {error}
        </p>
      )}

      <Btn
        onClick={handleConfirm}
        loading={submitting}
        size="lg"
        fullWidth
        disabled={!content.trim() || (!selectedClusterId && !newLabel.trim())}
      >
        {msgs.review.confirm}
      </Btn>
    </div>
  );
}
