"use client";

import { useState } from "react";
import { Btn } from "@/components/ui/Btn";
import { useLocale } from "@/lib/locale-context";
import clsx from "clsx";

interface ClusterDraft {
  label: string;
  summary: string;
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
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const inputClass = clsx(
    "w-full p-3 rounded-[6px] border text-sm leading-relaxed",
    "focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] focus:ring-offset-1",
    "bg-white text-[#14110d] border-[#e2ddd1] placeholder:text-[#7a7163]"
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-16">
      <h1
        className="text-2xl font-semibold text-[#14110d] mb-8"
        style={{ fontFamily: "Noto Serif Bengali, Georgia, serif" }}
      >
        {msgs.admin.compose}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: form */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#7a7163] mb-1.5">
                সপ্তাহ নম্বর
              </label>
              <input
                type="number"
                value={form.week}
                onChange={(e) => setForm((f) => ({ ...f, week: e.target.value }))}
                className={inputClass}
                placeholder="1"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7a7163] mb-1.5">
                {msgs.admin.category}
              </label>
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
            <label className="block text-xs font-medium text-[#7a7163] mb-1.5">
              {msgs.admin.question}
            </label>
            <textarea
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              className={clsx(inputClass, "min-h-[80px] resize-none")}
              placeholder="বাংলায় প্রশ্ন লিখুন..."
              maxLength={200}
              style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
            />
            <p className="text-xs text-[#7a7163] mt-0.5 text-right">{form.question.length}/200</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#7a7163] mb-1.5">
              {msgs.admin.questionEn}
            </label>
            <textarea
              value={form.questionEn}
              onChange={(e) => setForm((f) => ({ ...f, questionEn: e.target.value }))}
              className={clsx(inputClass, "min-h-[60px] resize-none")}
              placeholder="English version (optional)"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#7a7163] mb-1.5">
              {msgs.admin.context}
            </label>
            <textarea
              value={form.context}
              onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))}
              className={clsx(inputClass, "min-h-[100px] resize-y")}
              placeholder="ঐচ্ছিক প্রেক্ষাপট..."
              style={{ fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#7a7163] mb-1.5">
                {msgs.admin.opensAt}
              </label>
              <input
                type="datetime-local"
                value={form.opensAt}
                onChange={(e) => setForm((f) => ({ ...f, opensAt: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7a7163] mb-1.5">
                {msgs.admin.closesAt}
              </label>
              <input
                type="datetime-local"
                value={form.closesAt}
                onChange={(e) => setForm((f) => ({ ...f, closesAt: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-[#b85c1e] bg-[#fff4ef] rounded-[6px] px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-[#2d6a30] bg-[#edfbef] rounded-[6px] px-3 py-2">{success}</p>
          )}

          <div className="flex gap-2">
            <Btn onClick={handleSaveDraft} loading={saving} variant="secondary" size="md">
              খসড়া সংরক্ষণ
            </Btn>
            {topicId && (
              <Btn onClick={handleSeed} loading={seeding} variant="secondary" size="md">
                {msgs.admin.seedClusters}
              </Btn>
            )}
          </div>

          {topicId && (
            <div className="flex gap-2 pt-2 border-t border-[#e2ddd1]">
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
                variant="primary"
                size="md"
              >
                {msgs.admin.publish} (LIVE)
              </Btn>
            </div>
          )}
        </div>

        {/* Right: cluster preview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#7a7163] uppercase tracking-wider" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              ক্লাস্টার ({clusters.length})
            </h2>
            <button
              onClick={addCluster}
              className="text-xs text-[#7a7163] hover:text-[#3a342c] underline underline-offset-2"
            >
              + যোগ করুন
            </button>
          </div>

          {clusters.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[#e2ddd1] p-8 text-center">
              <p className="text-sm text-[#7a7163] bn-text" style={{ fontFamily: "Hind Siliguri, sans-serif" }}>
                AI ক্লাস্টার তৈরি করুন বা ম্যানুয়ালি যোগ করুন।
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {clusters.map((c, idx) => (
                <div
                  key={idx}
                  className="rounded-[12px] border border-[#e2ddd1] bg-white p-3 space-y-2"
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingCluster(null)}
                          className="text-xs text-[#7a7163] hover:text-[#3a342c]"
                        >
                          সম্পন্ন
                        </button>
                        <button
                          onClick={() => removeCluster(idx)}
                          className="text-xs text-[#b85c1e] hover:opacity-75"
                        >
                          মুছুন
                        </button>
                      </div>
                    </>
                  ) : (
                    <div
                      className="cursor-pointer"
                      onClick={() => setEditingCluster(idx)}
                    >
                      <p
                        className="text-sm font-medium text-[#14110d] bn-text"
                        style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                      >
                        {c.label || "(লেবেল নেই)"}
                      </p>
                      {c.summary && (
                        <p
                          className="text-xs text-[#7a7163] mt-0.5"
                          style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                        >
                          {c.summary}
                        </p>
                      )}
                    </div>
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
