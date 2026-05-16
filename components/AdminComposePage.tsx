"use client";

import { useState } from "react";
import { Btn } from "@/components/ui/Btn";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/ui/Icon";
import { useLocale } from "@/lib/locale-context";
import clsx from "clsx";

interface ClusterDraft {
  label: string;
  summary: string;
}

interface TopicImage {
  url: string;
  alt: string;
  source: string;
  creditName?: string | null;
  creditUrl?: string | null;
  color?: string | null;
}

const CATEGORY_OPTIONS = [
  { value: "society", label: "সমাজ / Society" },
  { value: "work", label: "কাজ / Work" },
  { value: "tech", label: "প্রযুক্তি / Tech" },
  { value: "cities", label: "শহর / Cities" },
  { value: "local", label: "স্থানীয় / Local" },
];

export function AdminComposePage() {
  const { msgs } = useLocale();
  const [form, setForm] = useState({
    week: "",
    category: "society",
    question: "",
    questionEn: "",
    context: "",
    opensAt: "",
    closesAt: "",
  });

  const [topicId, setTopicId] = useState<string | null>(null);
  const [clusters, setClusters] = useState<ClusterDraft[]>([]);
  const [editingCluster, setEditingCluster] = useState<number | null>(null);
  const [image, setImage] = useState<TopicImage | null>(null);
  const [manualImage, setManualImage] = useState({
    imageUrl: "",
    imageAlt: "",
    imageCreditName: "",
    imageCreditUrl: "",
  });
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function applyImage(next: TopicImage | null) {
    setImage(next);
    setManualImage({
      imageUrl: next?.url ?? "",
      imageAlt: next?.alt ?? "",
      imageCreditName: next?.creditName ?? "",
      imageCreditUrl: next?.creditUrl ?? "",
    });
  }

  async function requestAutoImage(idOverride?: string) {
    const id = idOverride ?? topicId;
    if (!id) return;

    setImageLoading(true);
    setImageError(null);
    const res = await fetch(`/api/admin/topics/${id}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "auto" }),
    });
    const data = await res.json().catch(() => ({}));
    setImageLoading(false);

    if (!res.ok) {
      setImageError("ছবি নির্বাচন করতে ব্যর্থ হয়েছে।");
      return;
    }

    if (data.image) {
      applyImage(data.image);
      setSuccess("প্রাসঙ্গিক ছবি যোগ হয়েছে।");
      return;
    }

    setImageError(data.warning ?? "কোনো ছবি পাওয়া যায়নি।");
  }

  async function handleManualImageSave() {
    if (!topicId) return;

    setImageLoading(true);
    setImageError(null);
    const res = await fetch(`/api/admin/topics/${topicId}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "manual",
        imageUrl: manualImage.imageUrl,
        imageAlt: manualImage.imageAlt,
        imageCreditName: manualImage.imageCreditName || undefined,
        imageCreditUrl: manualImage.imageCreditUrl || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setImageLoading(false);

    if (!res.ok) {
      setImageError("ম্যানুয়াল ছবি সংরক্ষণ করতে ব্যর্থ হয়েছে।");
      return;
    }

    applyImage(data.image);
    setSuccess("ছবি সংরক্ষিত হয়েছে।");
  }

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        week: parseInt(form.week),
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(JSON.stringify(data.error));
      return;
    }

    setTopicId(data.topic.id);
    setSuccess("খসড়া সংরক্ষিত হয়েছে।");
    void requestAutoImage(data.topic.id);
  }

  async function handleSeed() {
    if (!topicId) return;
    setSeeding(true);
    setError(null);

    const res = await fetch(`/api/admin/topics/${topicId}/seed`, {
      method: "POST",
    });

    const data = await res.json();
    setSeeding(false);

    if (!res.ok) {
      setError("AI ক্লাস্টার তৈরি করতে ব্যর্থ হয়েছে।");
      return;
    }

    setClusters(data.clusters);
    setSuccess(`${data.clusters.length}টি ক্লাস্টার তৈরি হয়েছে।`);
  }

  async function handlePublish(status: "scheduled" | "live") {
    if (!topicId) return;
    setPublishing(true);

    const res = await fetch(`/api/admin/topics/${topicId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    setPublishing(false);

    if (!res.ok) {
      setError("প্রকাশ করতে ব্যর্থ হয়েছে।");
      return;
    }

    setSuccess(`বিষয়টি ${status === "live" ? "সরাসরি প্রকাশিত" : "নির্ধারিত"} হয়েছে।`);
  }

  function updateCluster(idx: number, field: "label" | "summary", value: string) {
    setClusters((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function removeCluster(idx: number) {
    setClusters((prev) => prev.filter((_, i) => i !== idx));
  }

  function addCluster() {
    setClusters((prev) => [...prev, { label: "", summary: "" }]);
    setEditingCluster(clusters.length);
  }

  const fieldLabel = "voices-eyebrow block mb-2";
  const inputClass = clsx(
    "w-full p-3 rounded-[10px] border text-[14px] leading-relaxed bg-[var(--surface)] text-[var(--ink)] border-[var(--hairline)] placeholder:text-[var(--muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--paper)]"
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-16">
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Pill variant="default">ADMIN</Pill>
          <Pill variant="ai" icon={<Icon.Sparkle size={10} color="#fff" sw={2.5} />}>AI-ASSISTED</Pill>
        </div>
        <h1 className="voices-display text-4xl sm:text-5xl text-[var(--ink)]">
          {msgs.admin.compose}
        </h1>
        <p
          className="mt-3 voices-quote text-lg text-[var(--muted)]"
          style={{ fontFamily: "Newsreader, Georgia, serif", fontStyle: "italic" }}
        >
          You drop the question. AI seeds the starting clusters. You curate.
        </p>
        <hr className="voices-rule mt-6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Left: form (3/5) */}
        <div className="lg:col-span-3 space-y-5">
          <div>
            <span className="voices-eyebrow">QUESTION</span>
            <hr className="voices-rule-soft mt-1.5" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fieldLabel}>WEEK</label>
              <input
                type="number"
                value={form.week}
                onChange={(e) => setForm((f) => ({ ...f, week: e.target.value }))}
                className={clsx(inputClass, "voices-mono")}
                placeholder="01"
              />
            </div>
            <div>
              <label className={fieldLabel}>{msgs.admin.category.toUpperCase()}</label>
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
          </div>

          <div>
            <label className={fieldLabel}>{msgs.admin.question.toUpperCase()} · বাংলা</label>
            <textarea
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              className={clsx(inputClass, "min-h-[88px] resize-none voices-display-bn text-lg")}
              placeholder="বাংলায় প্রশ্ন লিখুন…"
              maxLength={200}
              style={{ fontFamily: "Noto Serif Bengali, Newsreader, Georgia, serif" }}
            />
            <p className="voices-mono text-[10px] mt-1 text-right text-[var(--muted)]">{form.question.length}/200</p>
          </div>

          <div>
            <label className={fieldLabel}>{msgs.admin.questionEn.toUpperCase()}</label>
            <textarea
              value={form.questionEn}
              onChange={(e) => setForm((f) => ({ ...f, questionEn: e.target.value }))}
              className={clsx(inputClass, "min-h-[64px] resize-none")}
              placeholder="English version (optional)"
              maxLength={200}
              style={{ fontFamily: "Newsreader, Georgia, serif", fontStyle: "italic" }}
            />
          </div>

          <div>
            <label className={fieldLabel}>{msgs.admin.context.toUpperCase()}</label>
            <textarea
              value={form.context}
              onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))}
              className={clsx(inputClass, "min-h-[100px] resize-y")}
              placeholder="ঐচ্ছিক প্রেক্ষাপট…"
              style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fieldLabel}>{msgs.admin.opensAt.toUpperCase()}</label>
              <input
                type="datetime-local"
                value={form.opensAt}
                onChange={(e) => setForm((f) => ({ ...f, opensAt: e.target.value }))}
                className={clsx(inputClass, "voices-mono text-[13px]")}
              />
            </div>
            <div>
              <label className={fieldLabel}>{msgs.admin.closesAt.toUpperCase()}</label>
              <input
                type="datetime-local"
                value={form.closesAt}
                onChange={(e) => setForm((f) => ({ ...f, closesAt: e.target.value }))}
                className={clsx(inputClass, "voices-mono text-[13px]")}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-[13px] rounded-[10px] px-3.5 py-2.5"
              style={{ background: "#fff4ef", color: "var(--warn)", border: "1px solid #f5d4c0" }}
            >
              <Icon.Warn size={14} sw={2} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 text-[13px] rounded-[10px] px-3.5 py-2.5"
              style={{ background: "#edfbef", color: "#2d6a30", border: "1px solid #c4dfc5" }}
            >
              <Icon.Check size={14} sw={2.2} />
              <span>{success}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Btn onClick={handleSaveDraft} loading={saving} variant="secondary" size="md">
              খসড়া সংরক্ষণ
            </Btn>
            {topicId && (
              <Btn onClick={handleSeed} loading={seeding} variant="secondary" size="md">
                <Icon.Sparkle size={14} sw={2} />
                {msgs.admin.seedClusters}
              </Btn>
            )}
          </div>

          {topicId && (
            <div
              className="flex flex-wrap gap-2 pt-4 border-t"
              style={{ borderColor: "var(--hairline)" }}
            >
              <Btn
                onClick={() => handlePublish("scheduled")}
                loading={publishing}
                variant="secondary"
                size="md"
              >
                নির্ধারিত করুন
              </Btn>
              <Btn
                onClick={() => handlePublish("live")}
                loading={publishing}
                variant="accent"
                size="md"
              >
                {msgs.admin.publish}
                <Icon.ArrowRight size={14} sw={2} />
              </Btn>
            </div>
          )}
        </div>

        {/* Right: cluster preview (2/5) */}
        <div className="lg:col-span-2 space-y-5">
          {topicId && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="voices-eyebrow">TOPIC IMAGE</span>
                  <hr className="voices-rule-soft mt-1.5" />
                </div>
                <button
                  type="button"
                  onClick={() => void requestAutoImage()}
                  disabled={imageLoading}
                  className="voices-eyebrow hover:text-[var(--ink)] disabled:opacity-40 transition-colors inline-flex items-center gap-1"
                >
                  <Icon.Sparkle size={10} sw={2.4} />
                  {imageLoading ? "LOADING" : "REGENERATE"}
                </button>
              </div>

              <div className="voices-card overflow-hidden">
                {image ? (
                  <div
                    className="aspect-[16/9] bg-[var(--surface-soft)] border-b"
                    style={{
                      borderColor: "var(--hairline-soft)",
                      backgroundColor: image.color ?? "var(--surface-soft)",
                    }}
                  >
                    <img
                      src={image.url}
                      alt={image.alt}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[16/9] flex items-center justify-center bg-[var(--surface-soft)] border-b"
                    style={{ borderColor: "var(--hairline-soft)" }}
                  >
                    <Icon.Sparkle size={20} color="var(--muted)" sw={1.8} />
                  </div>
                )}
                <div className="p-4 space-y-1.5">
                  <span className="voices-eyebrow">
                    {image ? image.source.toUpperCase() : "NO IMAGE YET"}
                  </span>
                  {image?.creditName && (
                    <p
                      className="text-[12px] text-[var(--muted)]"
                      style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                    >
                      Credit:{" "}
                      {image.creditUrl ? (
                        <a
                          href={image.creditUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-[var(--hairline)] underline-offset-2 hover:text-[var(--ink)]"
                        >
                          {image.creditName}
                        </a>
                      ) : (
                        image.creditName
                      )}
                    </p>
                  )}
                  {imageError && (
                    <p className="text-[12px]" style={{ color: "var(--warn)" }}>
                      {imageError}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="url"
                  value={manualImage.imageUrl}
                  onChange={(e) =>
                    setManualImage((prev) => ({ ...prev, imageUrl: e.target.value }))
                  }
                  className={clsx(inputClass, "text-xs")}
                  placeholder="https://... image URL"
                />
                <input
                  type="text"
                  value={manualImage.imageAlt}
                  onChange={(e) =>
                    setManualImage((prev) => ({ ...prev, imageAlt: e.target.value }))
                  }
                  className={clsx(inputClass, "text-xs")}
                  placeholder="Alt text"
                  maxLength={240}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={manualImage.imageCreditName}
                    onChange={(e) =>
                      setManualImage((prev) => ({ ...prev, imageCreditName: e.target.value }))
                    }
                    className={clsx(inputClass, "text-xs")}
                    placeholder="Credit name"
                    maxLength={120}
                  />
                  <input
                    type="url"
                    value={manualImage.imageCreditUrl}
                    onChange={(e) =>
                      setManualImage((prev) => ({ ...prev, imageCreditUrl: e.target.value }))
                    }
                    className={clsx(inputClass, "text-xs")}
                    placeholder="Credit URL"
                  />
                </div>
                <Btn
                  onClick={handleManualImageSave}
                  loading={imageLoading}
                  disabled={!manualImage.imageUrl.trim() || !manualImage.imageAlt.trim()}
                  variant="secondary"
                  size="sm"
                  fullWidth
                >
                  Save image
                </Btn>
              </div>
            </section>
          )}

          <div>
            <span className="voices-eyebrow">CLUSTERS · {clusters.length.toString().padStart(2, "0")}</span>
            <hr className="voices-rule-soft mt-1.5" />
          </div>

          <div className="flex items-center justify-between">
            <p
              className="voices-quote text-[15px] text-[var(--muted)]"
              style={{ fontFamily: "Newsreader, Georgia, serif", fontStyle: "italic" }}
            >
              Opinion seeds. Edit, remove, add.
            </p>
            <button
              onClick={addCluster}
              className="voices-eyebrow hover:text-[var(--ink)] transition-colors inline-flex items-center gap-1"
            >
              <Icon.Plus size={10} sw={2.4} />
              ADD
            </button>
          </div>

          {clusters.length === 0 ? (
            <div
              className="rounded-[var(--r-lg)] border-2 border-dashed p-8 text-center"
              style={{ borderColor: "var(--hairline)" }}
            >
              <Icon.Sparkle size={20} color="var(--muted)" sw={1.8} />
              <p
                className="mt-3 text-sm text-[var(--muted)] bn-text"
                style={{ fontFamily: "Hind Siliguri, sans-serif" }}
              >
                AI ক্লাস্টার তৈরি করুন বা ম্যানুয়ালি যোগ করুন।
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {clusters.map((c, idx) => (
                <div
                  key={idx}
                  className="voices-card p-4 space-y-2.5"
                >
                  {editingCluster === idx ? (
                    <>
                      <input
                        value={c.label}
                        onChange={(e) => updateCluster(idx, "label", e.target.value)}
                        className={clsx(inputClass, "text-sm")}
                        placeholder="লেবেল"
                        maxLength={120}
                        style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                      />
                      <textarea
                        value={c.summary}
                        onChange={(e) => updateCluster(idx, "summary", e.target.value)}
                        className={clsx(inputClass, "text-xs min-h-[60px]")}
                        placeholder="সারাংশ"
                        style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                      />
                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={() => setEditingCluster(null)}
                          className="voices-eyebrow hover:text-[var(--ink)] inline-flex items-center gap-1"
                        >
                          <Icon.Check size={10} sw={2.4} />
                          DONE
                        </button>
                        <button
                          onClick={() => removeCluster(idx)}
                          className="voices-eyebrow inline-flex items-center gap-1"
                          style={{ color: "var(--warn)" }}
                        >
                          <Icon.X size={10} sw={2.4} />
                          REMOVE
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="w-full text-left flex items-start gap-3"
                      onClick={() => setEditingCluster(idx)}
                    >
                      <span
                        className="voices-mono text-[11px] font-semibold shrink-0 mt-0.5"
                        style={{ color: "var(--muted)", letterSpacing: "0.08em" }}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[15px] font-semibold text-[var(--ink)] bn-text leading-snug"
                          style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                        >
                          {c.label || "(লেবেল নেই)"}
                        </p>
                        {c.summary && (
                          <p
                            className="text-[13px] text-[var(--muted)] mt-1 bn-text"
                            style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                          >
                            {c.summary}
                          </p>
                        )}
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
