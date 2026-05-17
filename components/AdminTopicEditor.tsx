"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Btn } from "@/components/ui/Btn";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/ui/Icon";

interface AdminCluster {
  id: string;
  label: string;
  summary?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageSource?: string | null;
  imageCreditName?: string | null;
  imageCreditUrl?: string | null;
  imageColor?: string | null;
  isAiSeeded: boolean;
  isMerged: boolean;
  order: number;
  _count: { takes: number; votes: number };
}

interface AdminTake {
  id: string;
  content: string;
  clusterId: string | null;
  audioUrl?: string | null;
  durationMs?: number | null;
  isAnon: boolean;
  isHidden: boolean;
  isFlagged: boolean;
  isPublished: boolean;
  isPending: boolean;
  asrConfidence?: number | null;
  createdAt: string;
  user?: { displayName?: string | null; isAnon?: boolean; email?: string | null } | null;
}

interface AdminTopic {
  id: string;
  week: number;
  category: string;
  question: string;
  questionEn?: string | null;
  context?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageSource?: string | null;
  imageCreditName?: string | null;
  imageCreditUrl?: string | null;
  imageColor?: string | null;
  opensAt: string;
  closesAt: string;
  status: "draft" | "scheduled" | "live" | "closed";
  createdAt: string;
  clusters: AdminCluster[];
  takes: AdminTake[];
  _count: { takes: number };
}

const CATEGORY_OPTIONS = [
  { value: "society", label: "সমাজ / Society" },
  { value: "work", label: "কাজ / Work" },
  { value: "tech", label: "প্রযুক্তি / Tech" },
  { value: "cities", label: "শহর / Cities" },
  { value: "local", label: "স্থানীয় / Local" },
];

function toLocalDateTimeInput(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputClass =
  "w-full p-2.5 rounded-[8px] border text-[14px] leading-relaxed bg-[var(--surface)] text-[var(--ink)] border-[var(--hairline)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--paper)]";

const fieldLabel = "voices-eyebrow block mb-1.5";

export function AdminTopicEditor({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [topic, setTopic] = useState<AdminTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    week: "",
    category: "society",
    question: "",
    questionEn: "",
    context: "",
    opensAt: "",
    closesAt: "",
    status: "draft" as AdminTopic["status"],
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/topics/${topicId}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to load topic.");
      return;
    }
    setTopic(data.topic);
    setForm({
      week: String(data.topic.week),
      category: data.topic.category,
      question: data.topic.question,
      questionEn: data.topic.questionEn ?? "",
      context: data.topic.context ?? "",
      opensAt: toLocalDateTimeInput(data.topic.opensAt),
      closesAt: toLocalDateTimeInput(data.topic.closesAt),
      status: data.topic.status,
    });
  }, [topicId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function flash(message: string) {
    setSuccess(message);
    window.setTimeout(() => setSuccess((s) => (s === message ? null : s)), 2500);
  }

  async function saveTopic() {
    setBusy("topic");
    setError(null);
    const res = await fetch(`/api/admin/topics/${topicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        week: form.week ? parseInt(form.week) : undefined,
        category: form.category,
        question: form.question,
        questionEn: form.questionEn || undefined,
        context: form.context || undefined,
        opensAt: form.opensAt ? new Date(form.opensAt).toISOString() : undefined,
        closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : undefined,
        status: form.status,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      return;
    }
    flash("Topic saved.");
    void load();
  }

  async function deleteTopic() {
    if (!confirm("Delete this topic and ALL its clusters, takes, and votes? This cannot be undone.")) return;
    setBusy("delete");
    const res = await fetch(`/api/admin/topics/${topicId}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Delete failed.");
      return;
    }
    router.push("/admin/topics");
  }

  async function regenerateTopicImage() {
    setBusy("topic-image");
    setError(null);
    const res = await fetch(`/api/admin/topics/${topicId}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "auto" }),
    });
    setBusy(null);
    if (!res.ok) {
      setError("Topic image regenerate failed.");
      return;
    }
    flash("Topic image refreshed.");
    void load();
  }

  async function setTopicImageManual() {
    const url = prompt("Image URL:");
    if (!url) return;
    const alt = prompt("Alt text:", "Topic illustration") || "Topic illustration";
    setBusy("topic-image");
    const res = await fetch(`/api/admin/topics/${topicId}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "manual", imageUrl: url, imageAlt: alt }),
    });
    setBusy(null);
    if (!res.ok) {
      setError("Manual topic image save failed.");
      return;
    }
    flash("Topic image saved.");
    void load();
  }

  async function reseed() {
    if (!confirm("AI-reseed clusters? Existing AI-seeded clusters on this topic will be replaced.")) return;
    setBusy("seed");
    const res = await fetch(`/api/admin/topics/${topicId}/seed`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Reseed failed (AI providers may be out of credits).");
      return;
    }
    flash("Clusters reseeded.");
    void load();
  }

  async function addCluster() {
    const label = prompt("New cluster label:");
    if (!label) return;
    const summary = prompt("Summary (optional):") || "";
    setBusy("add-cluster");
    const res = await fetch(`/api/admin/topics/${topicId}/clusters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, summary: summary || undefined }),
    });
    setBusy(null);
    if (!res.ok) {
      setError("Add cluster failed.");
      return;
    }
    flash("Cluster added.");
    void load();
  }

  async function patchCluster(id: string, body: Record<string, unknown>, successMsg: string) {
    setBusy(`cluster-${id}`);
    const res = await fetch(`/api/admin/clusters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      setError("Update failed.");
      return;
    }
    flash(successMsg);
    void load();
  }

  async function deleteCluster(id: string) {
    if (!confirm("Delete this cluster? Attached takes will be detached (not deleted).")) return;
    setBusy(`cluster-${id}`);
    const res = await fetch(`/api/admin/clusters/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      setError("Cluster delete failed.");
      return;
    }
    flash("Cluster deleted.");
    void load();
  }

  async function regenerateClusterImage(id: string) {
    setBusy(`cluster-img-${id}`);
    const res = await fetch(`/api/admin/clusters/${id}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "auto" }),
    });
    setBusy(null);
    if (!res.ok) {
      setError("Cluster image regenerate failed.");
      return;
    }
    flash("Cluster image refreshed.");
    void load();
  }

  async function setClusterImageManual(id: string) {
    const url = prompt("Image URL:");
    if (!url) return;
    const alt = prompt("Alt text:", "Cluster illustration") || "Cluster illustration";
    setBusy(`cluster-img-${id}`);
    const res = await fetch(`/api/admin/clusters/${id}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "manual", imageUrl: url, imageAlt: alt }),
    });
    setBusy(null);
    if (!res.ok) {
      setError("Manual cluster image save failed.");
      return;
    }
    flash("Cluster image saved.");
    void load();
  }

  async function patchTake(id: string, body: Record<string, unknown>, successMsg: string) {
    setBusy(`take-${id}`);
    const res = await fetch(`/api/admin/takes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      setError("Take update failed.");
      return;
    }
    flash(successMsg);
    void load();
  }

  async function deleteTake(id: string) {
    if (!confirm("Delete this take permanently?")) return;
    setBusy(`take-${id}`);
    const res = await fetch(`/api/admin/takes/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      setError("Take delete failed.");
      return;
    }
    flash("Take deleted.");
    void load();
  }

  async function editTakeContent(take: AdminTake) {
    const next = prompt("Edit take content:", take.content);
    if (next === null || next === take.content) return;
    await patchTake(take.id, { content: next }, "Take updated.");
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-16 space-y-3">
        <div className="h-10 w-2/3 rounded bg-[var(--hairline-soft)] animate-pulse" />
        <div className="h-32 rounded bg-[var(--hairline-soft)] animate-pulse" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-16 text-center">
        <p className="voices-eyebrow">TOPIC NOT FOUND</p>
        <Link href="/admin/topics" className="voices-eyebrow mt-3 inline-block">
          ← Back to topics
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-16">
      <div className="flex items-center gap-2 mb-3">
        <Pill variant="default">ADMIN</Pill>
        <Link href="/admin/topics" className="voices-eyebrow hover:text-[var(--ink)] transition-colors">
          ← TOPICS
        </Link>
      </div>
      <h1 className="voices-display text-3xl sm:text-4xl text-[var(--ink)] mb-2">
        Week {String(topic.week).padStart(2, "0")} · {topic.status.toUpperCase()}
      </h1>
      <p
        className="bn-text text-[15px] text-[var(--ink-soft)] leading-relaxed mb-6"
        style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
      >
        {topic.question}
      </p>

      <hr className="voices-rule mb-8" />

      {error && (
        <div className="mb-4 text-[13px] rounded-[10px] px-3.5 py-2.5"
          style={{ background: "#fff4ef", color: "var(--warn)", border: "1px solid #f5d4c0" }}
        >
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 text-[13px] rounded-[10px] px-3.5 py-2.5"
          style={{ background: "#edfbef", color: "#2d6a30", border: "1px solid #c4dfc5" }}
        >
          {success}
        </div>
      )}

      {/* ----- Topic fields ----- */}
      <section className="voices-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="voices-eyebrow">TOPIC FIELDS</span>
          <div className="flex gap-2">
            <Btn onClick={saveTopic} loading={busy === "topic"} size="sm" variant="secondary">
              Save
            </Btn>
            <Btn onClick={deleteTopic} loading={busy === "delete"} size="sm" variant="ghost">
              Delete topic
            </Btn>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={fieldLabel}>WEEK</label>
            <input
              type="number"
              value={form.week}
              onChange={(e) => setForm((f) => ({ ...f, week: e.target.value }))}
              className={clsx(inputClass, "voices-mono")}
            />
          </div>
          <div>
            <label className={fieldLabel}>CATEGORY</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputClass}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>STATUS</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AdminTopic["status"] }))}
              className={inputClass}
            >
              <option value="draft">draft</option>
              <option value="scheduled">scheduled</option>
              <option value="live">live</option>
              <option value="closed">closed</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <label className={fieldLabel}>QUESTION · বাংলা</label>
            <textarea
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              className={clsx(inputClass, "min-h-[72px] resize-none")}
              maxLength={200}
              style={{ fontFamily: "Noto Serif Bengali, Newsreader, Georgia, serif" }}
            />
          </div>
          <div className="md:col-span-3">
            <label className={fieldLabel}>QUESTION · ENGLISH</label>
            <textarea
              value={form.questionEn}
              onChange={(e) => setForm((f) => ({ ...f, questionEn: e.target.value }))}
              className={clsx(inputClass, "min-h-[56px] resize-none")}
              maxLength={200}
            />
          </div>
          <div className="md:col-span-3">
            <label className={fieldLabel}>CONTEXT</label>
            <textarea
              value={form.context}
              onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))}
              className={clsx(inputClass, "min-h-[80px] resize-y")}
            />
          </div>
          <div>
            <label className={fieldLabel}>OPENS AT</label>
            <input
              type="datetime-local"
              value={form.opensAt}
              onChange={(e) => setForm((f) => ({ ...f, opensAt: e.target.value }))}
              className={clsx(inputClass, "voices-mono text-[13px]")}
            />
          </div>
          <div>
            <label className={fieldLabel}>CLOSES AT</label>
            <input
              type="datetime-local"
              value={form.closesAt}
              onChange={(e) => setForm((f) => ({ ...f, closesAt: e.target.value }))}
              className={clsx(inputClass, "voices-mono text-[13px]")}
            />
          </div>
        </div>
      </section>

      {/* ----- Topic image ----- */}
      <section className="voices-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="voices-eyebrow">TOPIC IMAGE</span>
          <div className="flex gap-2">
            <Btn onClick={regenerateTopicImage} loading={busy === "topic-image"} size="sm" variant="secondary">
              <Icon.Sparkle size={13} sw={2} />
              Regenerate
            </Btn>
            <Btn onClick={setTopicImageManual} size="sm" variant="ghost">
              Manual URL
            </Btn>
          </div>
        </div>
        {topic.imageUrl ? (
          <figure className="flex flex-col sm:flex-row gap-4">
            <div
              className="sm:w-64 aspect-[16/9] overflow-hidden rounded-[10px] border bg-[var(--surface-soft)] shrink-0"
              style={{
                borderColor: "var(--hairline-soft)",
                backgroundColor: topic.imageColor ?? "var(--surface-soft)",
              }}
            >
              <img
                src={topic.imageUrl}
                alt={topic.imageAlt ?? ""}
                className="h-full w-full object-cover"
              />
            </div>
            <figcaption className="text-[13px] text-[var(--ink-soft)] space-y-1">
              <div><span className="voices-eyebrow">SOURCE</span> {topic.imageSource ?? "-"}</div>
              <div><span className="voices-eyebrow">CREDIT</span> {topic.imageCreditName ?? "-"}</div>
              <div className="break-all"><span className="voices-eyebrow">ALT</span> {topic.imageAlt ?? "-"}</div>
            </figcaption>
          </figure>
        ) : (
          <p className="text-[13px] text-[var(--muted)]">No image yet.</p>
        )}
      </section>

      {/* ----- Clusters ----- */}
      <section className="voices-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <span className="voices-eyebrow">
            CLUSTERS · {topic.clusters.length}
          </span>
          <div className="flex gap-2">
            <Btn onClick={addCluster} loading={busy === "add-cluster"} size="sm" variant="secondary">
              + Add cluster
            </Btn>
            <Btn onClick={reseed} loading={busy === "seed"} size="sm" variant="ghost">
              <Icon.Sparkle size={13} sw={2} />
              AI reseed
            </Btn>
          </div>
        </div>

        <ul className="space-y-3">
          {topic.clusters.map((cluster) => (
            <li
              key={cluster.id}
              className={clsx(
                "rounded-[10px] border p-4",
                cluster.isMerged ? "opacity-60" : ""
              )}
              style={{ borderColor: "var(--hairline-soft)" }}
            >
              <div className="flex items-start gap-4">
                {cluster.imageUrl ? (
                  <div
                    className="w-20 h-20 rounded-[8px] overflow-hidden shrink-0 bg-[var(--surface-soft)] border"
                    style={{ borderColor: "var(--hairline-soft)" }}
                  >
                    <img src={cluster.imageUrl} alt={cluster.imageAlt ?? ""} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    className="w-20 h-20 rounded-[8px] shrink-0 flex items-center justify-center voices-eyebrow"
                    style={{ background: "var(--surface-soft)" }}
                  >
                    NO IMG
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    value={cluster.label}
                    onChange={(e) =>
                      setTopic((t) =>
                        t
                          ? {
                              ...t,
                              clusters: t.clusters.map((c) =>
                                c.id === cluster.id ? { ...c, label: e.target.value } : c
                              ),
                            }
                          : t
                      )
                    }
                    onBlur={(e) => {
                      if (e.target.value !== cluster.label || true) {
                        // skip — saved explicitly via Save button below
                      }
                    }}
                    className={clsx(inputClass, "font-semibold")}
                  />
                  <textarea
                    value={cluster.summary ?? ""}
                    onChange={(e) =>
                      setTopic((t) =>
                        t
                          ? {
                              ...t,
                              clusters: t.clusters.map((c) =>
                                c.id === cluster.id ? { ...c, summary: e.target.value } : c
                              ),
                            }
                          : t
                      )
                    }
                    className={clsx(inputClass, "min-h-[56px] resize-y text-[13px]")}
                    placeholder="Summary (optional)"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="voices-eyebrow">
                      {cluster._count.takes} TAKES · {cluster._count.votes} VOTES · ORDER {cluster.order}
                    </span>
                    {cluster.isAiSeeded && <Pill variant="ai">AI</Pill>}
                    {cluster.isMerged && <Pill variant="ghost">HIDDEN</Pill>}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Btn
                      size="sm"
                      variant="secondary"
                      loading={busy === `cluster-${cluster.id}`}
                      onClick={() =>
                        patchCluster(
                          cluster.id,
                          { label: cluster.label, summary: cluster.summary ?? null },
                          "Cluster saved."
                        )
                      }
                    >
                      Save
                    </Btn>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        patchCluster(
                          cluster.id,
                          { isMerged: !cluster.isMerged },
                          cluster.isMerged ? "Cluster unhidden." : "Cluster hidden."
                        )
                      }
                    >
                      {cluster.isMerged ? "Unhide" : "Hide"}
                    </Btn>
                    <Btn
                      size="sm"
                      variant="ghost"
                      loading={busy === `cluster-img-${cluster.id}`}
                      onClick={() => regenerateClusterImage(cluster.id)}
                    >
                      <Icon.Sparkle size={11} sw={2} /> Regen img
                    </Btn>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => setClusterImageManual(cluster.id)}
                    >
                      Manual img
                    </Btn>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteCluster(cluster.id)}
                    >
                      Delete
                    </Btn>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ----- Takes ----- */}
      <section className="voices-card p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="voices-eyebrow">
            TAKES · {topic._count.takes} total
            {topic.takes.length < topic._count.takes && ` (showing ${topic.takes.length})`}
          </span>
        </div>

        {topic.takes.length === 0 ? (
          <p className="text-[13px] text-[var(--muted)]">No takes yet.</p>
        ) : (
          <ul className="space-y-3">
            {topic.takes.map((take) => {
              const cluster = topic.clusters.find((c) => c.id === take.clusterId);
              return (
                <li
                  key={take.id}
                  className="rounded-[10px] border p-4"
                  style={{ borderColor: "var(--hairline-soft)" }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {take.isPublished && <Pill variant="default">PUBLISHED</Pill>}
                      {take.isPending && <Pill variant="ghost">PENDING</Pill>}
                      {take.isFlagged && <Pill variant="ai">FLAGGED</Pill>}
                      {take.isHidden && <Pill variant="ghost">HIDDEN</Pill>}
                      <span className="voices-eyebrow">
                        {cluster ? cluster.label.slice(0, 28) : "UNASSIGNED"}
                      </span>
                    </div>
                    <span className="voices-mono text-[10px] text-[var(--muted)]">
                      {new Date(take.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p
                    className="text-[14px] text-[var(--ink)] leading-relaxed bn-text mb-3"
                    style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
                  >
                    {take.content}
                  </p>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="voices-eyebrow">
                      {take.user?.isAnon === false && take.user.displayName
                        ? take.user.displayName
                        : "ANON"}
                      {take.user?.email && ` · ${take.user.email}`}
                      {take.audioUrl && " · AUDIO"}
                      {typeof take.asrConfidence === "number" && ` · ${(take.asrConfidence * 100).toFixed(0)}%`}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <select
                        value={take.clusterId ?? ""}
                        onChange={(e) =>
                          patchTake(
                            take.id,
                            { clusterId: e.target.value || null },
                            "Take reassigned."
                          )
                        }
                        className={clsx(inputClass, "py-1.5 text-[12px] w-auto")}
                      >
                        <option value="">— unassigned —</option>
                        {topic.clusters.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                      <Btn size="sm" variant="ghost" onClick={() => editTakeContent(take)}>
                        Edit
                      </Btn>
                      <Btn
                        size="sm"
                        variant="ghost"
                        loading={busy === `take-${take.id}`}
                        onClick={() =>
                          patchTake(
                            take.id,
                            { isHidden: !take.isHidden },
                            take.isHidden ? "Take unhidden." : "Take hidden."
                          )
                        }
                      >
                        {take.isHidden ? "Unhide" : "Hide"}
                      </Btn>
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          patchTake(
                            take.id,
                            { isPublished: !take.isPublished, isPending: take.isPublished },
                            take.isPublished ? "Take unpublished." : "Take published."
                          )
                        }
                      >
                        {take.isPublished ? "Unpublish" : "Publish"}
                      </Btn>
                      <Btn size="sm" variant="ghost" onClick={() => deleteTake(take.id)}>
                        Delete
                      </Btn>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
