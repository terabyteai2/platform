"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { useCurrentUser } from "@/lib/user-context";
import { Btn } from "@/components/ui/Btn";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/ui/Icon";
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
  image?: {
    url: string;
    alt: string;
    source: string;
    creditName?: string | null;
    creditUrl?: string | null;
    color?: string | null;
  } | null;
  clusters: Cluster[];
}

type Step = "pick" | "record" | "processing";

export function RecordFlow() {
  const { locale, msgs } = useLocale();
  const { requireName } = useCurrentUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryTopicId = searchParams.get("topicId");

  const [topic, setTopic] = useState<TopicData | null>(null);
  const [resolvedTopicId, setResolvedTopicId] = useState<string | null>(
    queryTopicId && queryTopicId !== "undefined" ? queryTopicId : null
  );
  const [topicError, setTopicError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  // Audio recording state
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live transcript state. Deepgram streams into the editable textarea; the
  // user's edits are treated as the source of truth when sending.
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [captionsStatus, setCaptionsStatus] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Deepgram live streaming
  const deepgramWs = useRef<WebSocket | null>(null);
  const deepgramQueue = useRef<ArrayBuffer[]>([]); // PCM chunks captured before WS is open
  const deepgramReady = useRef(false);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const finalRef = useRef("");
  const transcriptScrollRef = useRef<HTMLTextAreaElement | null>(null);
  // Synchronous flag — React state setters are async, so we can't read
  // `recording` from async media/socket callbacks. The ref reflects the truth
  // right now.
  const isRecordingRef = useRef(false);

  // Load topic (falling back to active if no id supplied)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let id = resolvedTopicId;
        if (!id) {
          const r = await fetch("/api/topics/active", { cache: "no-store" });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await r.json();
          id = d?.topic?.id ?? null;
          if (!id) {
            if (!cancelled) setTopicError("No active topic right now. Check back next week.");
            return;
          }
          if (!cancelled) setResolvedTopicId(id);
        }
        const tr = await fetch(`/api/topics/${id}`);
        if (!tr.ok) throw new Error(`HTTP ${tr.status}`);
        const td = await tr.json();
        if (!cancelled) setTopic(td.topic);
      } catch (e) {
        if (!cancelled) {
          setTopicError(e instanceof Error ? e.message : "Couldn't load the topic.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedTopicId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      try { mediaRecorder.current?.stop(); } catch {}
      try { deepgramWs.current?.close(); } catch {}
      stopPcmStreaming();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Auto-scroll the transcript box to the bottom as new words arrive.
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [finalTranscript, interimTranscript]);

  function pickMimeType(): string {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/ogg;codecs=opus",
    ];
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  }

  // ─── Deepgram live streaming ────────────────────────────────────────────
  // Streams MediaRecorder chunks over a WebSocket and gets real-time
  // transcripts in <500ms.

  async function startDeepgramStream(sampleRate: number) {
    // Tear down any stale instance first. Re-record etc. can leave a previous
    // socket in CLOSING state and its callbacks would race with the new one.
    stopDeepgramStream();
    // Empty the queue so we don't accidentally replay the previous recording's
    // chunks into the new stream.
    deepgramQueue.current = [];

    try {
      const tokRes = await fetch("/api/deepgram/token", { method: "POST" });
      if (!tokRes.ok) throw new Error(`token grant failed (HTTP ${tokRes.status})`);
      const { token } = await tokRes.json();
      if (!token) throw new Error("token missing");

      const params = new URLSearchParams({
        encoding: "linear16",
        language: "bn",
        model: "nova-3",
        interim_results: "true",
        sample_rate: String(sampleRate),
        channels: "1",
        punctuate: "true",
      });
      const url = `wss://api.deepgram.com/v1/listen?${params}`;
      // Deepgram WebSocket auth uses the subprotocol header:
      // Sec-WebSocket-Protocol: token, <key>
      const ws = new WebSocket(url, ["token", token]);
      deepgramWs.current = ws;
      deepgramReady.current = false;

      // If the socket never opens within 5s, give up and tell the user.
      const openWatchdog = setTimeout(() => {
        if (deepgramWs.current === ws && !deepgramReady.current) {
          console.warn("[deepgram] WS open timed out");
          setCaptionsStatus("Live captions: stream didn't open — try again or check network.");
          try { ws.close(); } catch {}
        }
      }, 5000);
      const clearWatchdog = () => clearTimeout(openWatchdog);

      // Every callback below guards on `deepgramWs.current === ws`. If we
      // start a fresh stream before this one finishes closing, the old
      // socket's late callbacks must not clobber the new socket's state.

      ws.onopen = () => {
        clearWatchdog();
        if (deepgramWs.current !== ws) {
          try { ws.close(); } catch {}
          return;
        }
        deepgramReady.current = true;
        console.log("[deepgram] WS open");
        for (const chunk of deepgramQueue.current) {
          try { ws.send(chunk); } catch {}
        }
        deepgramQueue.current = [];
      };

      ws.onmessage = (ev) => {
        if (deepgramWs.current !== ws) return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "Results") {
            const alt = msg.channel?.alternatives?.[0];
            const text: string = alt?.transcript ?? "";
            if (!text) return;
            if (msg.is_final || msg.speech_final) {
              appendDeepgramFinal(text);
              setInterimTranscript("");
              console.log(`[deepgram] final «${text}»`);
            } else {
              setInterimTranscript(text);
              setFinalTranscript(transcriptWithInterim(text));
            }
          }
        } catch {
          // Ignore non-JSON / control messages
        }
      };

      ws.onerror = () => {
        if (deepgramWs.current !== ws) return;
        console.warn("[deepgram] WS error");
        setCaptionsStatus("Live captions: stream error — recording continues.");
      };

      ws.onclose = (ev) => {
        clearWatchdog();
        console.log(`[deepgram] WS close · code=${ev.code} reason=${ev.reason}`);
        if (deepgramWs.current !== ws) return;
        deepgramReady.current = false;
        deepgramWs.current = null;
      };
    } catch (err) {
      console.warn("[deepgram] failed to start:", err);
      setCaptionsStatus(
        err instanceof Error
          ? `Live captions: ${err.message}`
          : "Live captions failed to start."
      );
    }
  }

  function sendChunkToDeepgram(chunk: ArrayBuffer) {
    const ws = deepgramWs.current;
    if (!ws) {
      deepgramQueue.current.push(chunk);
      return;
    }
    if (deepgramReady.current && ws.readyState === WebSocket.OPEN) {
      ws.send(chunk);
    } else {
      deepgramQueue.current.push(chunk);
    }
  }

  function startPcmStreaming(stream: MediaStream): number {
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error("This browser can't stream live captions from the microphone.");
    }

    stopPcmStreaming();
    const ctx = new AudioContextCtor();
    void ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      if (!isRecordingRef.current || paused) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const sample = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      sendChunkToDeepgram(pcm.buffer.slice(0));
    };

    source.connect(processor);
    // Some browsers stop firing ScriptProcessor callbacks unless it is
    // connected to an output. Gain 0 keeps this silent.
    const gain = ctx.createGain();
    gain.gain.value = 0;
    processor.connect(gain);
    gain.connect(ctx.destination);

    audioContextRef.current = ctx;
    audioSourceRef.current = source;
    audioProcessorRef.current = processor;
    return ctx.sampleRate;
  }

  function stopPcmStreaming() {
    const processor = audioProcessorRef.current;
    const source = audioSourceRef.current;
    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    if (processor) {
      try { processor.onaudioprocess = null; } catch {}
      try { processor.disconnect(); } catch {}
    }
    if (source) {
      try { source.disconnect(); } catch {}
    }
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx) {
      try { void ctx.close(); } catch {}
    }
  }

  /**
   * Append a Deepgram final fragment to the editable transcript. We read the
   * authoritative current value from `finalRef.current` (which the textarea
   * keeps in sync), so a user's manual edits are preserved.
   */
  function appendDeepgramFinal(fragment: string) {
    const text = fragment.trim();
    if (!text) return;
    const prev = finalRef.current.trimEnd();
    if (prev && prev.endsWith(text)) return;
    finalRef.current = (prev ? prev + " " : "") + text;
    setFinalTranscript(finalRef.current);
  }

  function transcriptWithInterim(fragment: string): string {
    const text = fragment.trim();
    if (!text) return finalRef.current;
    const prev = finalRef.current.trimEnd();
    if (prev && prev.endsWith(text)) return prev;
    return (prev ? prev + " " : "") + text;
  }

  function commitInterimTranscript() {
    const text = interimTranscript.trim();
    if (!text) return;
    appendDeepgramFinal(text);
    setInterimTranscript("");
  }

  function stopDeepgramStream() {
    const ws = deepgramWs.current;
    deepgramWs.current = null;
    deepgramReady.current = false;
    deepgramQueue.current = [];
    stopKeepAlive();
    if (!ws) return;
    // Detach handlers so any late events from this socket don't update the
    // (possibly newly-started) next session's state.
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "CloseStream" }));
      }
    } catch {}
    try { ws.close(); } catch {}
  }

  /**
   * Periodically ping the Deepgram socket while we're not sending audio
   * (i.e. while paused), so it doesn't drop on the ~10s silence timeout.
   * Deepgram's documented format: `{ "type": "KeepAlive" }`.
   */
  function startKeepAlive() {
    stopKeepAlive();
    keepAliveRef.current = setInterval(() => {
      const ws = deepgramWs.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try { ws.send(JSON.stringify({ type: "KeepAlive" })); } catch {}
    }, 5000);
  }

  function stopKeepAlive() {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }

  async function startRecording() {
    setSubmitError(null);
    setAudioBlob(null);
    setFinalTranscript("");
    setInterimTranscript("");
    finalRef.current = "";

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setSubmitError("Your browser doesn't support audio recording. Try Chrome, Firefox, or Safari.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setSubmitError("Microphone access was denied. Allow it in your browser settings and try again.");
      } else if (name === "NotFoundError") {
        setSubmitError("No microphone found.");
      } else {
        setSubmitError("Couldn't start the microphone.");
      }
      return;
    }

    streamRef.current = stream;
    const mimeType = pickMimeType();
    let mr: MediaRecorder;
    try {
      mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setSubmitError("Audio recording isn't supported on this browser.");
      return;
    }

    mediaRecorder.current = mr;
    chunks.current = [];

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.current.push(e.data);
      }
    };

    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const blobType = mr.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks.current, { type: blobType });
      setAudioBlob(blob);
    };

    mr.onerror = () => {
      setSubmitError("Recording stopped unexpectedly.");
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      isRecordingRef.current = false;
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      stopPcmStreaming();
      stopDeepgramStream();
    };

    isRecordingRef.current = true;
    setRecording(true);
    setElapsed(0);
    // Deepgram gets raw PCM from Web Audio for stable live captions; the
    // MediaRecorder still creates the saved audio file separately.
    try {
      const sampleRate = startPcmStreaming(stream);
      startDeepgramStream(sampleRate);
    } catch (err) {
      console.warn("[captions] PCM streaming unavailable:", err);
      setCaptionsStatus(
        err instanceof Error ? err.message : "Live captions couldn't start."
      );
    }
    mr.start(250);

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
    isRecordingRef.current = false;
    commitInterimTranscript();
    const state = mediaRecorder.current?.state;
    if (state === "recording" || state === "paused") {
      mediaRecorder.current?.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    setPaused(false);
    stopPcmStreaming();
    stopDeepgramStream();
  }

  function pauseRecording() {
    if (mediaRecorder.current?.state !== "recording") return;
    mediaRecorder.current.pause();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPaused(true);
    setInterimTranscript("");
    // Keep the Deepgram WebSocket open across pauses. MediaRecorder produces
    // a single continuous WebM stream — the header was in the first chunk and
    // Deepgram needs to keep its decoder state to handle later chunks. If we
    // tore it down, a fresh socket would see header-less chunks and discard
    // them. Send periodic KeepAlive pings so Deepgram doesn't drop us on its
    // silence timeout.
    startKeepAlive();
    if (audioContextRef.current?.state === "running") {
      void audioContextRef.current.suspend().catch(() => {});
    }
  }

  function resumeRecording() {
    if (mediaRecorder.current?.state !== "paused") return;
    stopKeepAlive();
    if (audioContextRef.current?.state === "suspended") {
      void audioContextRef.current.resume().catch(() => {});
    }
    // Safety net: if the socket died despite keepalive, spin up a new one.
    if (!deepgramWs.current || deepgramWs.current.readyState !== WebSocket.OPEN) {
      console.warn("[deepgram] socket dropped during pause — reopening");
      const sampleRate = audioContextRef.current?.sampleRate ?? 48000;
      startDeepgramStream(sampleRate);
    }
    mediaRecorder.current.resume();
    setPaused(false);
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

  /**
   * Single button cycle: start → pause → resume → pause → resume …
   * The separate "Done" button is what actually finalises the recording.
   */
  function toggleRecording() {
    if (!recording) {
      startRecording();
      return;
    }
    if (paused) resumeRecording();
    else pauseRecording();
  }

  function resetRecording() {
    setAudioBlob(null);
    setFinalTranscript("");
    setInterimTranscript("");
    finalRef.current = "";
    setElapsed(0);
    setSubmitError(null);
    setCaptionsStatus(null);
    // Make sure no captioning socket is left over from the previous attempt.
    stopDeepgramStream();
  }

  async function handleProceed() {
    if (!audioBlob) return;
    if (!resolvedTopicId) {
      setSubmitError("No active topic — try going back to the home page.");
      return;
    }
    setSubmitError(null);

    const hasName = await requireName(
      "Before saving your review, tell us the name or username that should be attached to your activity."
    );
    if (!hasName) return;

    setStep("processing");

    const clusterIdForServer =
      selectedClusterId && selectedClusterId !== "other" ? selectedClusterId : undefined;

    try {
      const intentRes = await fetch("/api/takes/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: resolvedTopicId,
          ...(clusterIdForServer ? { clusterId: clusterIdForServer } : {}),
        }),
      });
      if (!intentRes.ok) {
        const body = await intentRes.json().catch(() => ({}));
        throw new Error(body.error || `Couldn't start upload (HTTP ${intentRes.status}).`);
      }
      const intentData = await intentRes.json();
      const newTakeId: string | undefined = intentData?.takeId;
      if (!newTakeId) {
        throw new Error("Upload server didn't return a take id.");
      }

      // Upload through our own API to dodge B2's cross-origin restrictions.
      const uploadRes = await fetch(`/api/takes/${newTakeId}/upload`, {
        method: "POST",
        body: audioBlob,
        headers: { "Content-Type": audioBlob.type || "audio/webm" },
      });
      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({}));
        throw new Error(body.error || `Audio upload failed (HTTP ${uploadRes.status}).`);
      }
      const uploadData = await uploadRes.json();
      const audioPath: string | undefined = uploadData?.publicPath;
      if (!audioPath) {
        throw new Error("Upload didn't return a storage path.");
      }

      const clientTranscript = (finalRef.current || finalTranscript).trim();
      const finalizeRes = await fetch(`/api/takes/${newTakeId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioPath,
          durationMs: elapsed * 1000,
          ...(clientTranscript ? { clientTranscript } : {}),
        }),
      });
      if (!finalizeRes.ok) {
        const body = await finalizeRes.json().catch(() => ({}));
        throw new Error(body.error || `Transcription failed (HTTP ${finalizeRes.status}).`);
      }

      router.push(`/record/review?takeId=${newTakeId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("record");
    }
  }

  // ─── Early-out states ─────────────────────────────────────────────────────

  if (topicError) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-20 text-center space-y-4">
        <span className="voices-eyebrow block">NO TOPIC AVAILABLE</span>
        <h2 className="voices-display text-2xl sm:text-3xl text-[var(--ink)]">
          Can&apos;t record right now.
        </h2>
        <p
          className="text-[14px] text-[var(--muted)] max-w-md mx-auto"
          style={{ fontFamily: "Hind Siliguri, sans-serif" }}
        >
          {topicError}
        </p>
        <div className="pt-2">
          <Btn onClick={() => router.push("/")} variant="secondary" size="md">
            ← হোমে ফিরুন
          </Btn>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-16 text-center space-y-2">
        <span className="voices-eyebrow">{msgs.admin.loading}</span>
        <p className="text-[var(--muted)] bn-text">লোড হচ্ছে…</p>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="max-w-xl mx-auto px-4 pt-24 text-center space-y-5">
        <span className="voices-eyebrow">SENDING</span>
        <div className="flex justify-center gap-1.5 mb-6 items-end h-12">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="wave-bar w-1.5 rounded-full bg-[var(--accent)]"
              style={{ height: "100%" }}
            />
          ))}
        </div>
        <p
          className="voices-display text-2xl text-[var(--ink)] bn-serif"
          style={{ fontFamily: "Noto Serif Bengali, Newsreader, Georgia, serif" }}
        >
          আপলোড হচ্ছে…
        </p>
        <p className="text-sm text-[var(--muted)]" style={{ fontFamily: "Hind Siliguri, sans-serif" }}>
          {msgs.record.savingHint}
        </p>
      </div>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 pt-10 pb-16">
      {/* Topic context */}
      <div className="mb-8">
        {topic.image && (
          <figure className="mb-6">
            <div
              className="aspect-[16/9] overflow-hidden rounded-[10px] border bg-[var(--surface-soft)]"
              style={{
                borderColor: "var(--hairline)",
                backgroundColor: topic.image.color ?? "var(--surface-soft)",
              }}
            >
              <img
                src={topic.image.url}
                alt={topic.image.alt}
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>
            {topic.image.source === "unsplash" && topic.image.creditName && (
              <figcaption className="mt-2 voices-eyebrow normal-case tracking-normal">
                Photo by{" "}
                {topic.image.creditUrl ? (
                    <a
                      href={topic.image.creditUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-[var(--hairline)] underline-offset-2 hover:text-[var(--ink)]"
                    >
                      {topic.image.creditName}
                    </a>
                ) : (
                  topic.image.creditName
                )}{" "}
                on{" "}
                <a
                  href="https://unsplash.com/?utm_source=voices_discussion_platform&utm_medium=referral"
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-[var(--hairline)] underline-offset-2 hover:text-[var(--ink)]"
                >
                  Unsplash
                </a>
              </figcaption>
            )}
          </figure>
        )}

        <span className="voices-eyebrow">THIS WEEK&apos;S QUESTION</span>
        <p
          className="mt-3 voices-display-bn text-2xl sm:text-3xl text-[var(--ink)]"
          style={{
            fontFamily: locale === "en"
              ? "Newsreader, Georgia, serif"
              : "Noto Serif Bengali, Newsreader, Georgia, serif",
          }}
        >
          {locale === "en" && topic.questionEn ? topic.questionEn : topic.question}
        </p>
        <hr className="voices-rule mt-6" />
      </div>

      {/* Step 1: Pick cluster (optional) */}
      {step === "pick" && (
        <div className="space-y-5">
          <h2
            className="voices-display-bn text-xl sm:text-2xl text-[var(--ink)] bn-text"
            style={{ fontFamily: "Hind Siliguri, sans-serif", fontWeight: 600 }}
          >
            {msgs.record.step1Title}
          </h2>

          {topic.clusters.length > 0 ? (
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
                  setSelectedClusterId(selectedClusterId === "other" ? null : "other")
                }
              />
            </div>
          ) : null}

          <div className="pt-2">
            <Btn
              onClick={() => setStep("record")}
              size="lg"
              variant="accent"
              fullWidth
            >
              <Icon.Mic size={16} sw={2} />
              {selectedClusterId ? msgs.record.next : msgs.record.skip}
              <Icon.ArrowRight size={16} sw={2} />
            </Btn>
          </div>
        </div>
      )}

      {/* Step 2: Record */}
      {step === "record" && (
        <div className="space-y-6">
          <button
            onClick={() => setStep("pick")}
            className="voices-eyebrow hover:text-[var(--ink)] transition-colors inline-flex items-center gap-1"
          >
            <Icon.ArrowLeft size={10} sw={2.4} />
            {msgs.record.back.toUpperCase()}
          </button>

          <h2
            className="voices-display-bn text-xl sm:text-2xl text-[var(--ink)] bn-text"
            style={{ fontFamily: "Hind Siliguri, sans-serif", fontWeight: 600 }}
          >
            {msgs.record.step2Title}
          </h2>

          {/* Timer + waveform line */}
          <div className="flex items-center justify-between gap-4">
            <span
              className="voices-mono text-3xl sm:text-4xl font-semibold text-[var(--ink)] tabular-nums"
              style={{ letterSpacing: "-0.025em" }}
            >
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
              <span className="voices-mono text-sm text-[var(--muted)] ml-1">/ 01:00</span>
            </span>

            {recording && (
              <div className="flex gap-1 items-end h-7">
                {[...Array(6)].map((_, i) => (
                  <span
                    key={i}
                    className="wave-bar w-1 rounded-full"
                    style={{ height: "100%", background: "var(--accent)" }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Live transcript pane — voice-keyboard style */}
          <div className="voices-card overflow-hidden">
            {/* Header strip */}
            <div
              className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-b"
              style={{ borderColor: "var(--hairline-soft)", background: "var(--surface-soft)" }}
            >
              <div className="flex items-center gap-2">
                {recording && !paused ? (
                  <>
                    <span className="voices-live-dot" />
                    <span
                      className="voices-eyebrow"
                      style={{ color: "var(--live)", letterSpacing: "0.16em" }}
                    >
                      {msgs.record.listening}
                    </span>
                  </>
                ) : recording && paused ? (
                  <>
                    <span
                      className="inline-block w-1.5 h-3 rounded-[1px]"
                      style={{ background: "var(--ink-soft)" }}
                    />
                    <span
                      className="inline-block w-1.5 h-3 rounded-[1px] -ml-2.5 translate-x-3"
                      style={{ background: "var(--ink-soft)" }}
                    />
                    <span className="voices-eyebrow ml-2" style={{ color: "var(--ink-soft)" }}>
                      {msgs.record.pausedEdit}
                    </span>
                  </>
                ) : audioBlob ? (
                  <>
                    <Icon.Check size={11} sw={2.4} color="var(--accent)" />
                    <span className="voices-eyebrow">{msgs.record.captured}</span>
                  </>
                ) : (
                  <>
                    <Icon.Mic size={11} sw={2.2} color="var(--muted)" />
                    <span className="voices-eyebrow">{msgs.record.ready}</span>
                  </>
                )}
              </div>

              {/* Right slot intentionally empty — language toggle and char
                  counter were removed to simplify the chrome. */}
            </div>

            {/* Body — editable textarea, captions append into it */}
            <div className="px-4 sm:px-5 py-3" aria-live="polite">
              <textarea
                ref={transcriptScrollRef}
                value={finalTranscript}
                onChange={(e) => {
                  // User edits become the new ground truth. Mirror to the ref
                  // so the next Deepgram-final appends after the edited text.
                  finalRef.current = e.target.value;
                  setInterimTranscript("");
                  setFinalTranscript(e.target.value);
                }}
                placeholder={
                  recording
                    ? msgs.record.transcriptPlaceholderListening
                    : audioBlob
                      ? msgs.record.transcriptPlaceholderCaptured
                      : msgs.record.transcriptPlaceholderReady
                }
                rows={5}
                className="w-full resize-y bg-transparent text-[18px] sm:text-[19px] leading-relaxed bn-text text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none p-0"
                style={{
                  fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif",
                  minHeight: 96,
                  maxHeight: 280,
                }}
              />
            </div>
          </div>

          {captionsStatus && (
            <p
              className="text-[12px] leading-snug text-center px-2"
              style={{
                color: "var(--muted)",
                fontFamily: "Hind Siliguri, sans-serif",
              }}
            >
              {captionsStatus}
            </p>
          )}

          {/* Mic button — start ↔ pause ↔ resume. A separate end button stops
              the recorder and reveals preview + send. */}
          <div className="flex flex-col items-center gap-3 pt-1">
            <button
              type="button"
              onClick={toggleRecording}
              disabled={elapsed >= 60 && !recording}
              className={clsx(
                "w-20 h-20 rounded-full flex items-center justify-center select-none",
                "transition-all duration-150",
                "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]",
                recording && !paused
                  ? "bg-[var(--warn)] text-white shadow-[0_8px_32px_-8px_var(--warn)] animate-pulse"
                  : "bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)] active:scale-95 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
              aria-label={
                !recording
                  ? msgs.record.tapStart
                  : paused
                    ? msgs.record.tapResume
                    : msgs.record.tapPause
              }
            >
              {recording && !paused ? (
                /* Pause icon — two vertical bars */
                <span className="flex gap-1.5">
                  <span className="w-1.5 h-7 rounded-[2px] bg-white" />
                  <span className="w-1.5 h-7 rounded-[2px] bg-white" />
                </span>
              ) : (
                <Icon.Mic size={28} color="white" sw={1.8} />
              )}
            </button>

            <p
              className="text-sm font-semibold text-[var(--ink)] bn-text"
              style={{ fontFamily: "Hind Siliguri, sans-serif" }}
            >
              {!recording
                ? audioBlob
                  ? msgs.record.tapMore
                  : msgs.record.tapStart
                : paused
                  ? msgs.record.tapResume
                  : msgs.record.tapPause}
            </p>
            <p className="voices-eyebrow">{msgs.record.banglaHint}</p>

            {recording && (
              <Btn
                type="button"
                onClick={stopRecording}
                size="md"
                variant="warn"
                className="mt-1"
              >
                <span className="w-3 h-3 rounded-[2px] bg-current" aria-hidden="true" />
                {msgs.record.stop}
              </Btn>
            )}
          </div>

          {/* Error banner */}
          {submitError && (
            <div
              className="flex items-start gap-2 text-[13px] rounded-[10px] px-3.5 py-2.5"
              style={{
                background: "#fff4ef",
                color: "var(--warn)",
                border: "1px solid #f5d4c0",
              }}
            >
              <Icon.Warn size={14} sw={2} />
              <span>{submitError}</span>
            </div>
          )}

          {/* Audio preview + send. Available as soon as recording is stopped,
              regardless of whether there's a transcript yet. */}
          {audioBlob && !recording && (
            <div className="space-y-3 pt-2">
              <div className="voices-card p-3">
                <audio
                  controls
                  src={URL.createObjectURL(audioBlob)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Btn
                  onClick={resetRecording}
                  size="md"
                  variant="secondary"
                >
                  <Icon.X size={14} sw={2} />
                  {msgs.record.redo}
                </Btn>
                <Btn
                  onClick={handleProceed}
                  size="md"
                  variant="accent"
                  fullWidth
                  disabled={!finalTranscript.trim()}
                >
                  {msgs.record.send}
                  <Icon.ArrowRight size={16} sw={2} />
                </Btn>
              </div>
              {!finalTranscript.trim() && (
                <p
                  className="text-[12px] text-[var(--muted)] text-center"
                  style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                >
                  {msgs.record.editBeforeSend}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
