"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { useCurrentUser } from "@/lib/user-context";
import { Btn } from "@/components/ui/Btn";
import { ConfidenceChip } from "@/components/ui/ConfidenceChip";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/ui/Icon";
import clsx from "clsx";

interface TakeData {
  id: string;
  content: string;
  asrConfidence?: number | null;
  asrProvider?: string | null;
  audioUrl?: string | null;
  clusterId?: string | null;
  aiSuggestedClusterId?: string | null;
  aiMatchScore?: number | null;
  topicId: string;
  cluster?: { id: string; label: string } | null;
}

interface ClusterInfo {
  id: string;
  label: string;
  summary?: string | null;
}

export function ReviewFlow() {
  const { msgs } = useLocale();
  const { user: currentUser, requireName, openEditor } = useCurrentUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const takeId = searchParams.get("takeId");

  const [take, setTake] = useState<TakeData | null>(null);
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [clusterManuallySelected, setClusterManuallySelected] = useState(false);
  const [showNewCluster, setShowNewCluster] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [manualIsAnon, setManualIsAnon] = useState<boolean | null>(null);
  const isAnon = manualIsAnon ?? !currentUser?.displayName;
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ published: boolean; pending?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aiClusterLoading, setAiClusterLoading] = useState(false);
  const [aiClusterError, setAiClusterError] = useState<string | null>(null);
  const [aiClusterMode, setAiClusterMode] = useState<"existing" | "new" | null>(null);
  const autoClusterRequestedRef = useRef(false);

  const missingTakeId = !takeId || takeId === "undefined";

  // When the take loads with an empty transcript (e.g. ASR couldn't reach the
  // audio), put the cursor in the textarea so the user can just start typing.
  useEffect(() => {
    if (!take) return;
    if (take.content.trim() !== "") return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
  }, [take]);

  useEffect(() => {
    if (missingTakeId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/takes/${takeId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setLoadError(body.error || `Couldn't load take (HTTP ${res.status}).`);
          return;
        }
        const d = await res.json();
        const t = d?.take as TakeData | undefined;
        if (!t) {
          if (!cancelled) setLoadError("Take not found.");
          return;
        }
        if (cancelled) return;
        setTake(t);
        setContent(t.content ?? "");
        setSelectedClusterId(t.aiSuggestedClusterId ?? t.clusterId ?? null);
        setClusterManuallySelected(false);
        setAiClusterMode(t.aiSuggestedClusterId ? "existing" : null);

        const topicRes = await fetch(`/api/topics/${t.topicId}`);
        if (!topicRes.ok) return; // non-fatal — cluster picker just stays empty
        const topicData = await topicRes.json();
        if (!cancelled) {
          setClusters(
            topicData.topic?.clusters?.map((c: ClusterInfo) => ({
              id: c.id,
              label: c.label,
              summary: c.summary,
            })) ?? []
          );
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load take.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [takeId, missingTakeId]);

  const requestAiCluster = useCallback(
    async (sourceContent?: string) => {
      if (!takeId || !take) return;
      const transcript = (sourceContent ?? content).trim();
      if (!transcript) return;

      setAiClusterLoading(true);
      setAiClusterError(null);

      try {
        const res = await fetch(`/api/takes/${takeId}/cluster`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: transcript }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `AI cluster failed (HTTP ${res.status}).`);
        }

        const result = data.result as
          | {
              clusterId?: string | null;
              matchScore?: number | null;
              isNew?: boolean;
              cluster?: ClusterInfo | null;
            }
          | null
          | undefined;

        if (!result?.clusterId || !result.cluster) {
          throw new Error("AI did not return a cluster.");
        }

        setClusters((prev) => {
          if (prev.some((cluster) => cluster.id === result.cluster!.id)) return prev;
          return [...prev, result.cluster!];
        });
        setSelectedClusterId(result.clusterId);
        setClusterManuallySelected(false);
        setShowNewCluster(false);
        setAiClusterMode(result.isNew ? "new" : "existing");
        setTake((prev) =>
          prev
            ? {
                ...prev,
                content: transcript,
                clusterId: result.clusterId ?? null,
                aiSuggestedClusterId: result.clusterId ?? null,
                aiMatchScore: result.matchScore ?? null,
              }
            : prev
        );
      } catch (err) {
        setAiClusterMode(null);
        setAiClusterError(
          err instanceof Error
            ? err.message
            : "AI could not select a cluster. You can choose one manually."
        );
      } finally {
        setAiClusterLoading(false);
      }
    },
    [content, take, takeId]
  );

  useEffect(() => {
    if (!take || autoClusterRequestedRef.current) return;
    if (!take.content.trim()) return;
    if (take.aiSuggestedClusterId || take.clusterId) return;
    autoClusterRequestedRef.current = true;
    const timer = window.setTimeout(() => {
      void requestAiCluster(take.content);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestAiCluster, take]);

  async function handleConfirm() {
    if (!takeId || !take) return;

    let publishAnon = isAnon;
    if (!currentUser?.displayName?.trim()) {
      const hasName = await requireName(
        "Before saving your review, tell us the name or username that should be attached to your activity."
      );
      if (!hasName) return;
      publishAnon = false;
      setManualIsAnon(false);
    }

    setSubmitting(true);
    setError(null);

    const contentChanged = content.trim() !== take.content.trim();
    const body: Record<string, unknown> = {
      content,
      isAnon: publishAnon,
    };

    if (showNewCluster && newLabel.trim()) {
      body.newClusterLabel = newLabel.trim();
    } else if (
      selectedClusterId &&
      (clusterManuallySelected || (selectedClusterId === take.aiSuggestedClusterId && !contentChanged))
    ) {
      body.clusterId = selectedClusterId;
    }

    try {
      const res = await fetch(`/api/takes/${takeId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 422) {
        setError(msgs.errors.flagged);
        return;
      }
      if (!res.ok) {
        setError(data.error || msgs.errors.generic);
        return;
      }

      setDone(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : msgs.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  const displayError = missingTakeId
    ? msgs.review.missingTakeId
    : loadError;

  if (displayError) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-20 text-center space-y-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mx-auto" style={{ background: "#fff4ef" }}>
          <Icon.Warn size={26} color="var(--warn)" sw={2} />
        </div>
        <h2
          className="voices-display-bn text-2xl sm:text-3xl text-[var(--ink)] bn-text"
          style={{ fontFamily: "Noto Serif Bengali, Newsreader, Georgia, serif" }}
        >
          {msgs.review.loadFailedTitle}
        </h2>
        <p
          className="text-[14px] text-[var(--muted)] max-w-md mx-auto bn-text"
          style={{ fontFamily: "Hind Siliguri, sans-serif" }}
        >
          {displayError}
        </p>
        <div className="pt-2 flex justify-center gap-2 flex-wrap">
          <Btn onClick={() => router.push("/")} variant="secondary" size="md">
            <Icon.ArrowLeft size={14} sw={2} />
            {msgs.review.goHome}
          </Btn>
          <Btn onClick={() => router.back()} variant="ghost" size="md">
            {msgs.review.tryAgain}
          </Btn>
        </div>
      </div>
    );
  }

  if (!take) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-16 text-center space-y-2">
        <span className="voices-eyebrow">{msgs.review.loading}</span>
        <p className="text-[var(--muted)] bn-text">লোড হচ্ছে…</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-20 text-center space-y-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--accent-soft)] mx-auto">
          <Icon.Check size={28} color="var(--accent)" sw={2.2} />
        </div>
        <span className="voices-eyebrow block">
          {done.pending ? msgs.review.queued : msgs.review.published}
        </span>
        <h2
          className="voices-display-bn text-3xl sm:text-4xl text-[var(--ink)] bn-text"
          style={{ fontFamily: "Noto Serif Bengali, Newsreader, Georgia, serif" }}
        >
          {done.pending ? msgs.review.pending : msgs.review.publishedHeading}
        </h2>
        <p
          className="text-[15px] text-[var(--ink-soft)] bn-text max-w-md mx-auto"
          style={{ fontFamily: "Hind Siliguri, sans-serif" }}
        >
          {done.pending ? msgs.review.pendingDesc : msgs.review.publishedDesc}
        </p>
        <div className="pt-2">
          <Btn onClick={() => router.push("/")} variant="secondary" size="md">
            <Icon.ArrowLeft size={14} sw={2} />
            {msgs.review.goHome}
          </Btn>
        </div>
      </div>
    );
  }

  const isLowConfidence = (take.asrConfidence ?? 1) < 0.7;
  const audioSrc = take.audioUrl ? `/api/takes/${take.id}/audio` : null;
  const transcriptEmpty = !content.trim();
  const selectedAiClusterIsStale =
    !!selectedClusterId &&
    selectedClusterId === take.aiSuggestedClusterId &&
    content.trim() !== take.content.trim() &&
    !clusterManuallySelected;
  const inputBase =
    "w-full p-3 rounded-[8px] border text-[14px] leading-relaxed bg-[var(--surface)] text-[var(--ink)] border-[var(--hairline)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--paper)]";

  return (
    <div className="max-w-[430px] mx-auto px-4 pt-4 pb-20 space-y-5">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ink)]"
          >
            <Icon.ArrowLeft size={13} sw={2.2} />
            Re-record
          </button>
          <span className="voices-eyebrow">STEP 3 OF 3</span>
        </div>
        <h1
          className="voices-display-bn text-[22px] text-[var(--ink)] bn-text"
          style={{ fontFamily: "Noto Serif Bengali, Newsreader, Georgia, serif" }}
        >
          {msgs.review.title}
        </h1>
        <p className="mt-1 text-[12px] text-[var(--muted)]">
          Edit the transcript if anything is off, then confirm where it belongs.
        </p>
      </div>

      {/* Audio playback — so the user can hear themselves while editing */}
      {audioSrc && (
        <section className="space-y-3">
          <span className="voices-eyebrow">{msgs.review.yourRecording}</span>
          <div className="voices-card p-3">
            <audio controls src={audioSrc} className="w-full" preload="metadata" />
          </div>
        </section>
      )}

      {/* Transcript */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="voices-eyebrow">{msgs.review.transcript.toUpperCase()}</span>
          <button className="text-[11px] font-semibold text-[var(--ink)]">Edit</button>
          {take.asrConfidence != null && <ConfidenceChip confidence={take.asrConfidence} />}
        </div>

        {/* Empty-transcript helper — auto-transcription couldn't reach the audio */}
        {transcriptEmpty && (
          <div
            className="flex items-start gap-2 text-[13px] rounded-[10px] px-3.5 py-2.5"
            style={{
              background: "var(--surface)",
              color: "var(--ink-soft)",
              border: "1px solid var(--hairline)",
            }}
          >
            <Icon.Mic size={14} sw={2} color="var(--muted)" />
            <span className="bn-text" style={{ fontFamily: "Hind Siliguri, sans-serif" }}>
              {msgs.review.couldNotAutoTranscribe}
            </span>
          </div>
        )}

        {!transcriptEmpty && isLowConfidence && (
          <div
            className="flex items-start gap-2 text-[13px] rounded-[10px] px-3.5 py-2.5"
            style={{
              background: "#fff4ef",
              color: "var(--warn)",
              border: "1px solid #f5d4c0",
            }}
          >
            <Icon.Warn size={14} sw={2} />
            <span>{msgs.review.lowConfidence}</span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setAiClusterError(null);
          }}
          className={clsx(inputBase, "min-h-[132px] resize-y")}
          style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
          placeholder={msgs.review.editHint}
        />
      </section>

  {/* Cluster selection */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Pill variant="ai" icon={<Icon.Sparkle size={10} color="#fff" sw={2.5} />}>AI CLUSTERED</Pill>
          <span className="voices-eyebrow normal-case tracking-normal">Sounds most like:</span>
        </div>

        <div
          className="rounded-[8px] border px-3 py-2.5 text-[13px]"
          style={{
            borderColor: aiClusterError ? "#f5d4c0" : "var(--hairline)",
            background: aiClusterError ? "#fff4ef" : "var(--surface)",
            color: aiClusterError ? "var(--warn)" : "var(--ink-soft)",
            fontFamily: "Hind Siliguri, sans-serif",
          }}
        >
          {aiClusterLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              AI আপনার মতামত কোন ক্লাস্টারে পড়ে দেখছে...
            </span>
          ) : selectedClusterId ? (
            <span>
              {selectedAiClusterIsStale
                ? "ট্রান্সক্রিপ্ট বদলেছে। সাবমিট করলে AI আবার চেক করবে। আগের পছন্দ: "
                : aiClusterMode === "new"
                  ? "AI নতুন ক্লাস্টার বানিয়েছে: "
                  : "AI বেছে নিয়েছে: "}
              <strong className="text-[var(--ink)]">
                {clusters.find((cluster) => cluster.id === selectedClusterId)?.label ?? "Selected cluster"}
              </strong>
              {take.aiMatchScore != null && (
                <span className="voices-mono ml-2">
                  {Math.round(take.aiMatchScore * 100)}%
                </span>
              )}
            </span>
          ) : aiClusterError ? (
            <span>{aiClusterError}</span>
          ) : (
            <span>AI এখনও কোনো ক্লাস্টার বেছে নেয়নি।</span>
          )}
          <button
            type="button"
            onClick={() => {
              setClusterManuallySelected(false);
              void requestAiCluster(content);
            }}
            disabled={aiClusterLoading || !content.trim()}
            className="voices-eyebrow ml-3 hover:text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {selectedClusterId ? "AI AGAIN" : "ASK AI"}
          </button>
        </div>

        {!showNewCluster ? (
          <div className="space-y-2">
            {clusters.map((c) => (
              <Pill
                key={c.id}
                label={c.label}
                selected={selectedClusterId === c.id}
                onClick={() => {
                  setSelectedClusterId(c.id);
                  setClusterManuallySelected(true);
                  setShowNewCluster(false);
                }}
              />
            ))}
            <button
              onClick={() => {
                setShowNewCluster(true);
                setSelectedClusterId(null);
                setClusterManuallySelected(true);
              }}
              className="w-full rounded-[8px] border border-dashed border-[var(--muted)] px-3 py-2 text-left voices-eyebrow hover:text-[var(--ink)] transition-colors inline-flex items-center gap-1"
            >
              <Icon.Plus size={10} sw={2.4} />
              {msgs.review.newCluster.toUpperCase()}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="নতুন ক্লাস্টারের নাম লিখুন…"
              maxLength={80}
              className={inputBase}
              style={{ fontFamily: "Hind Siliguri, sans-serif" }}
            />
            <button
              onClick={() => setShowNewCluster(false)}
              className="voices-eyebrow hover:text-[var(--ink)] transition-colors"
            >
              ← {msgs.review.switchCluster.toUpperCase()}
            </button>
          </div>
        )}
      </section>

      {/* Identity — compact one-line layout */}
      <section className="voices-card p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <span className="voices-eyebrow">{msgs.review.publishingAs}</span>
          <p
            className="mt-1 text-[15px] font-semibold text-[var(--ink)] bn-text truncate"
            style={{ fontFamily: "Hind Siliguri, Plus Jakarta Sans, sans-serif" }}
          >
            {isAnon
              ? msgs.avatar.anon
              : currentUser?.displayName || msgs.avatar.required}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Btn variant="ghost" size="sm" onClick={openEditor}>
            {currentUser?.displayName ? msgs.avatar.yourName : msgs.avatar.addName}
          </Btn>
          <label className="flex items-center cursor-pointer shrink-0" title={isAnon ? msgs.review.appearAnon : msgs.review.appearAs.replace("{name}", currentUser?.displayName ?? "")}>
            <input
              type="checkbox"
              checked={isAnon}
              onChange={(e) => setManualIsAnon(e.target.checked)}
              disabled={!currentUser?.displayName}
              className="sr-only peer"
            />
            <span
              className={clsx(
                "relative w-10 h-6 rounded-full transition-colors",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--paper)]",
                !currentUser?.displayName && "opacity-40 cursor-not-allowed"
              )}
              style={{ backgroundColor: isAnon ? "var(--accent)" : "var(--hairline)" }}
              aria-label={isAnon ? msgs.avatar.anon : msgs.review.publishingAs}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: isAnon ? "translateX(16px)" : "translateX(0)" }}
              />
            </span>
          </label>
        </div>
      </section>

      {error && (
        <div
          className="flex items-start gap-2 text-[13px] rounded-[10px] px-3.5 py-2.5"
          style={{
            background: "#fff4ef",
            color: "var(--warn)",
            border: "1px solid #f5d4c0",
          }}
        >
          <Icon.Warn size={14} sw={2} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-[1fr_1.25fr] gap-2">
        <Btn onClick={() => router.back()} size="md" variant="secondary">
          Edit
        </Btn>
        <Btn
          onClick={handleConfirm}
          loading={submitting}
          size="md"
          variant="accent"
          fullWidth
          disabled={!content.trim()}
        >
          {msgs.review.confirm}
        </Btn>
      </div>
    </div>
  );
}
