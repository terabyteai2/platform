"use client";

import { useEffect, useRef, useState } from "react";
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

function resolveAudioUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  // Local-fs paths look like "local:takes/<id>.webm" — served from public/uploads.
  if (stored.startsWith("local:")) {
    return `/uploads/${stored.slice("local:".length)}`;
  }
  // Bare keys ("takes/<id>.webm") fall through to the same place; full URLs
  // (signed B2 URLs, etc.) are returned as-is.
  if (stored.startsWith("http://") || stored.startsWith("https://")) return stored;
  return `/uploads/${stored}`;
}

interface ClusterInfo {
  id: string;
  label: string;
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
  const [showNewCluster, setShowNewCluster] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [manualIsAnon, setManualIsAnon] = useState<boolean | null>(null);
  const isAnon = manualIsAnon ?? !currentUser?.displayName;
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ published: boolean; pending?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

        const topicRes = await fetch(`/api/topics/${t.topicId}`);
        if (!topicRes.ok) return; // non-fatal — cluster picker just stays empty
        const topicData = await topicRes.json();
        if (!cancelled) {
          setClusters(
            topicData.topic?.clusters?.map((c: ClusterInfo) => ({ id: c.id, label: c.label })) ?? []
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

    const body: Record<string, unknown> = {
      content,
      isAnon: publishAnon,
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
      setError(data.error || msgs.errors.generic);
      return;
    }

    setDone(data);
  }

  const displayError = missingTakeId
    ? "Missing take id — go back and record again."
    : loadError;

  if (displayError) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-20 text-center space-y-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mx-auto" style={{ background: "#fff4ef" }}>
          <Icon.Warn size={26} color="var(--warn)" sw={2} />
        </div>
        <span className="voices-eyebrow block">SOMETHING WENT WRONG</span>
        <h2
          className="voices-display text-2xl sm:text-3xl text-[var(--ink)]"
        >
          We couldn&apos;t load your take.
        </h2>
        <p
          className="text-[14px] text-[var(--muted)] max-w-md mx-auto"
          style={{ fontFamily: "Hind Siliguri, sans-serif" }}
        >
          {displayError}
        </p>
        <div className="pt-2 flex justify-center gap-2 flex-wrap">
          <Btn onClick={() => router.push("/")} variant="secondary" size="md">
            <Icon.ArrowLeft size={14} sw={2} />
            হোমে ফিরুন
          </Btn>
          <Btn onClick={() => router.back()} variant="ghost" size="md">
            Try again
          </Btn>
        </div>
      </div>
    );
  }

  if (!take) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-16 text-center space-y-2">
        <span className="voices-eyebrow">LOADING</span>
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
          {done.pending ? "QUEUED FOR REVIEW" : "PUBLISHED"}
        </span>
        <h2
          className="voices-display-bn text-3xl sm:text-4xl text-[var(--ink)] bn-text"
          style={{ fontFamily: "Noto Serif Bengali, Newsreader, Georgia, serif" }}
        >
          {done.pending ? msgs.review.pending : "প্রকাশিত হয়েছে!"}
        </h2>
        <p
          className="text-[15px] text-[var(--ink-soft)] bn-text max-w-md mx-auto"
          style={{ fontFamily: "Hind Siliguri, sans-serif" }}
        >
          {done.pending ? msgs.review.pendingDesc : "আপনার মতামত যোগ হয়েছে।"}
        </p>
        <div className="pt-2">
          <Btn onClick={() => router.push("/")} variant="secondary" size="md">
            <Icon.ArrowLeft size={14} sw={2} />
            হোমে ফিরুন
          </Btn>
        </div>
      </div>
    );
  }

  const isLowConfidence = (take.asrConfidence ?? 1) < 0.7;
  const audioSrc = resolveAudioUrl(take.audioUrl);
  const transcriptEmpty = !content.trim();
  const inputBase =
    "w-full p-4 rounded-[10px] border text-[15px] leading-relaxed bg-[var(--surface)] text-[var(--ink)] border-[var(--hairline)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--paper)]";

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 pt-10 pb-16 space-y-8">
      <div>
        <span className="voices-eyebrow">REVIEW · STEP 3 OF 3</span>
        <h1
          className="mt-2 voices-display-bn text-3xl sm:text-4xl text-[var(--ink)] bn-text"
          style={{ fontFamily: "Noto Serif Bengali, Newsreader, Georgia, serif" }}
        >
          {msgs.review.title}
        </h1>
        <hr className="voices-rule mt-6" />
      </div>

      {/* Audio playback — so the user can hear themselves while editing */}
      {audioSrc && (
        <section className="space-y-3">
          <span className="voices-eyebrow">YOUR RECORDING</span>
          <div className="voices-card p-3">
            <audio controls src={audioSrc} className="w-full" preload="metadata" />
          </div>
        </section>
      )}

      {/* Transcript */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="voices-eyebrow">{msgs.review.transcript.toUpperCase()}</span>
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
            <span>
              We couldn&apos;t auto-transcribe your audio (your network can&apos;t reach our speech
              service). <strong>Listen back above</strong> and type what you said below — that&apos;s
              what gets published.
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
          onChange={(e) => setContent(e.target.value)}
          className={clsx(inputBase, "min-h-[140px] resize-y")}
          style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
          placeholder={msgs.review.editHint}
        />
      </section>

      {/* Cluster selection */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="voices-eyebrow">{msgs.review.aiCluster.toUpperCase()}</span>
          <Pill variant="ai" icon={<Icon.Sparkle size={10} color="#fff" sw={2.5} />}>AI</Pill>
        </div>

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
              className="voices-eyebrow hover:text-[var(--ink)] transition-colors inline-flex items-center gap-1"
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

      {/* Identity */}
      <section className="voices-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="voices-eyebrow">PUBLISHING AS</span>
            <p
              className="mt-1 text-[15px] font-semibold text-[var(--ink)] bn-text truncate"
              style={{ fontFamily: "Hind Siliguri, Plus Jakarta Sans, sans-serif" }}
            >
              {isAnon ? "Anonymous" : currentUser?.displayName || "Name needed"}
            </p>
            {!currentUser?.displayName && (
              <p
                className="text-[12px] text-[var(--muted)] mt-0.5"
                style={{ fontFamily: "Hind Siliguri, sans-serif" }}
              >
                Your name will be requested before this review is saved.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 w-full sm:w-auto">
            <Btn variant="ghost" size="sm" onClick={openEditor}>
              {currentUser?.displayName ? "Change" : "Add name"}
            </Btn>
            <label className="flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isAnon}
                onChange={(e) => {
                  setManualIsAnon(e.target.checked);
                }}
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
                aria-label="Toggle anonymous publishing"
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: isAnon ? "translateX(16px)" : "translateX(0)" }}
                />
              </span>
            </label>
          </div>
        </div>
        <p
          className="mt-3 text-[12px] text-[var(--muted)]"
          style={{ fontFamily: "Hind Siliguri, sans-serif" }}
        >
          {isAnon
            ? "Your take will appear under «Anonymous»."
            : `Your take will appear under «${currentUser?.displayName ?? "your name"}».`}
        </p>
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

      <Btn
        onClick={handleConfirm}
        loading={submitting}
        size="lg"
        variant="accent"
        fullWidth
        disabled={!content.trim() || (!selectedClusterId && !newLabel.trim())}
      >
        {msgs.review.confirm}
        <Icon.ArrowRight size={16} sw={2} />
      </Btn>
    </div>
  );
}
