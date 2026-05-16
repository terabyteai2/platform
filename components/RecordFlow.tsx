"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { Btn } from "@/components/ui/Btn";
import { Pill } from "@/components/ui/Pill";
import clsx from "clsx";

interface Cluster {
  id: string;
  label: string;
  summary?: string | null;
}

interface TopicData {
  id: string;
  question: string;
  questionEn?: string | null;
  clusters: Cluster[];
}

type Step = "pick" | "record" | "processing";

export function RecordFlow() {
  const { locale, msgs } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const topicId = searchParams.get("topicId");

  const [topic, setTopic] = useState<TopicData | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [takeId, setTakeId] = useState<string | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!topicId) return;
    fetch(`/api/topics/${topicId}`)
      .then((r) => r.json())
      .then((d) => setTopic(d.topic));
  }, [topicId]);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorder.current = mr;
    chunks.current = [];

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };

    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      setAudioBlob(blob);
    };

    mr.start(250);
    setRecording(true);
    setElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        if (e >= 59) {
          stopRecording();
          return 60;
        }
        return e + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }

  async function handleProceed() {
    if (!audioBlob || !topicId) return;
    setStep("processing");

    // 1. Get intent (create take + upload URL)
    const intentRes = await fetch("/api/takes/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, clusterId: selectedClusterId }),
    });
    const { takeId: newTakeId, uploadUrl, publicPath } = await intentRes.json();
    setTakeId(newTakeId);
    setAudioPath(publicPath);

    // 2. Upload audio to B2
    await fetch(uploadUrl, {
      method: "PUT",
      body: audioBlob,
      headers: { "Content-Type": "audio/webm" },
    });

    // 3. Finalize (transcribe + cluster)
    await fetch(`/api/takes/${newTakeId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioPath: publicPath,
        durationMs: elapsed * 1000,
      }),
    });

    router.push(`/record/review?takeId=${newTakeId}`);
  }

  if (!topic) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-12 text-center">
        <p className="text-[#7a7163]">লোড হচ্ছে...</p>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="max-w-xl mx-auto px-4 pt-20 text-center space-y-4">
        <div className="flex justify-center gap-1.5 mb-6">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="wave-bar w-1.5 rounded-full bg-[#1a1a1a]"
              style={{ height: "32px" }}
            />
          ))}
        </div>
        <p
          className="text-[#14110d] font-medium bn-text"
          style={{ fontFamily: "Hind Siliguri, sans-serif" }}
        >
          {msgs.record.processing}
        </p>
        <p className="text-sm text-[#7a7163]">ট্রান্সক্রাইব ও ক্লাস্টার হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 pt-8 pb-16">
      {/* Topic context */}
      <div className="mb-6 p-4 rounded-[12px] bg-white border border-[#e2ddd1]">
        <p
          className="text-base font-semibold text-[#14110d] leading-snug bn-serif"
          style={{ fontFamily: "Noto Serif Bengali, Georgia, serif" }}
        >
          {locale === "en" && topic.questionEn ? topic.questionEn : topic.question}
        </p>
      </div>

      {/* Step 1: Pick cluster */}
      {step === "pick" && (
        <div className="space-y-4">
          <h2
            className="text-lg font-semibold text-[#14110d] bn-text"
            style={{ fontFamily: "Hind Siliguri, sans-serif" }}
          >
            {msgs.record.step1Title}
          </h2>
          <p className="text-sm text-[#7a7163] bn-text" style={{ fontFamily: "Hind Siliguri, sans-serif" }}>
            {msgs.record.step1Desc}
          </p>

          <div className="flex flex-wrap gap-2">
            {topic.clusters.map((c) => (
              <Pill
                key={c.id}
                label={c.label}
                selected={selectedClusterId === c.id}
                onClick={() =>
                  setSelectedClusterId(selectedClusterId === c.id ? null : c.id)
                }
              />
            ))}
            <Pill
              label={msgs.record.other}
              selected={selectedClusterId === "other"}
              onClick={() =>
                setSelectedClusterId(
                  selectedClusterId === "other" ? null : "other"
                )
              }
            />
          </div>

          <div className="pt-4">
            <Btn
              onClick={() => setStep("record")}
              size="lg"
              fullWidth
            >
              {msgs.record.next} →
            </Btn>
          </div>
        </div>
      )}

      {/* Step 2: Record */}
      {step === "record" && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep("pick")}
              className="text-sm text-[#7a7163] hover:text-[#3a342c]"
            >
              ← {msgs.record.back}
            </button>
          </div>

          <h2
            className="text-lg font-semibold text-[#14110d] bn-text"
            style={{ fontFamily: "Hind Siliguri, sans-serif" }}
          >
            {msgs.record.step2Title}
          </h2>

          {/* Timer */}
          <div className="flex justify-center">
            <span
              className="text-4xl font-bold text-[#14110d] tabular-nums"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
              <span className="text-[#7a7163] text-lg ml-1">/ 01:00</span>
            </span>
          </div>

          {/* Waveform animation while recording */}
          {recording && (
            <div className="flex justify-center gap-1.5 h-12 items-end">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="wave-bar w-2 rounded-full bg-[#1a1a1a]"
                  style={{ height: "100%" }}
                />
              ))}
            </div>
          )}

          {/* Mic button */}
          <div className="flex flex-col items-center gap-3">
            <button
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              onPointerLeave={stopRecording}
              disabled={elapsed >= 60}
              className={clsx(
                "w-24 h-24 rounded-full flex items-center justify-center",
                "text-3xl font-bold select-none touch-none",
                "transition-all duration-150 shadow-md",
                recording
                  ? "bg-[#b85c1e] text-white scale-95 shadow-lg"
                  : "bg-[#1a1a1a] text-white hover:opacity-90 active:scale-95",
                "disabled:opacity-40"
              )}
              aria-label={recording ? msgs.record.recording : msgs.record.holdToRecord}
            >
              {recording ? "●" : "🎙"}
            </button>
            <p className="text-sm text-[#7a7163] bn-text" style={{ fontFamily: "Hind Siliguri, sans-serif" }}>
              {recording ? msgs.record.recording : msgs.record.holdToRecord}
            </p>
            <p className="text-xs text-[#7a7163]">{msgs.record.banglaHint}</p>
          </div>

          {/* Show recorded blob */}
          {audioBlob && !recording && (
            <div className="space-y-3">
              <audio
                controls
                src={URL.createObjectURL(audioBlob)}
                className="w-full"
              />
              <Btn
                onClick={handleProceed}
                size="lg"
                fullWidth
              >
                {msgs.record.next} →
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
