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
  clusters: Cluster[];
}

type Step = "pick" | "record" | "processing";

// ─── Web Speech API minimal types ──────────────────────────────────────────
// Browsers expose this API but TS doesn't ship types. We only touch the bits
// we use.
interface SRAlternative {
  transcript: string;
  confidence: number;
}
interface SRResult {
  isFinal: boolean;
  readonly length: number;
  [index: number]: SRAlternative;
}
interface SRResultList {
  readonly length: number;
  [index: number]: SRResult;
}
interface SREvent extends Event {
  resultIndex: number;
  results: SRResultList;
}
interface SRErrorEvent extends Event {
  error:
    | "no-speech"
    | "aborted"
    | "audio-capture"
    | "network"
    | "not-allowed"
    | "service-not-allowed"
    | "bad-grammar"
    | "language-not-supported"
    | (string & {});
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SREvent) => void) | null;
  onerror: ((ev: SRErrorEvent) => void) | null;
  onend: ((ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

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

  // Live transcript state (Web Speech API)
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [captionsStatus, setCaptionsStatus] = useState<string | null>(null);
  const [resultCount, setResultCount] = useState(0);
  const [captionsLang, setCaptionsLang] = useState<"bn-BD" | "en-US">(
    locale === "en" ? "en-US" : "bn-BD"
  );
  // Lazy init — runs once on the client, undefined during SSR which the UI
  // treats as "unknown / show nothing".
  const [liveCaptionsSupported] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    return getSpeechRecognitionCtor() != null;
  });

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Deepgram live streaming
  const deepgramWs = useRef<WebSocket | null>(null);
  const deepgramQueue = useRef<Blob[]>([]); // chunks captured before WS is open
  const deepgramReady = useRef(false);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalRef = useRef("");
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  // Synchronous flag — React state setters are async, so we can't read
  // `recording` from inside SpeechRecognition's `onend` closure to decide
  // whether to restart. The ref reflects the truth right now.
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
      try { recognitionRef.current?.abort(); } catch {}
      try { mediaRecorder.current?.stop(); } catch {}
      try { deepgramWs.current?.close(); } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Auto-scroll the transcript box to the bottom as new words arrive.
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [finalTranscript, interimTranscript]);

  // Watchdog: if we've been recording for ~4 seconds with zero captions yet,
  // surface a hint. Audio is still captured — this is purely about the live
  // preview not the upload.
  useEffect(() => {
    if (!recording) return;
    if (resultCount > 0) return;
    const t = setTimeout(() => {
      if (isRecordingRef.current && resultCount === 0 && !captionsStatus) {
        setCaptionsStatus(
          "Live captions can't reach Google's speech service from this network. Audio is being recorded normally — the server will transcribe it after you tap Send."
        );
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [recording, resultCount, captionsStatus, captionsLang]);

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

  function startLiveCaptions(langOverride?: "bn-BD" | "en-US") {
    setCaptionsStatus(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setCaptionsStatus("Live captions aren't supported in this browser.");
      return;
    }
    try {
      const recog = new Ctor();
      recog.continuous = true;
      recog.interimResults = true;
      const lang = langOverride ?? captionsLang;
      recog.lang = lang;

      // Lightweight diagnostics — visible in DevTools so we can tell whether
      // the recognizer is actually getting audio or silently failing.
      console.log(`[captions] starting · lang=${lang}`);

      recog.onresult = (ev) => {
        let interim = "";
        let gotAny = false;
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const text = res[0]?.transcript ?? "";
          if (!text) continue;
          gotAny = true;
          if (res.isFinal) {
            finalRef.current = (finalRef.current ? finalRef.current + " " : "") + text;
            setFinalTranscript(finalRef.current);
            console.log(`[captions] final  «${text}»`);
          } else {
            interim += text;
          }
        }
        setInterimTranscript(interim);
        if (gotAny) setResultCount((n) => n + 1);
      };

      recog.onerror = (ev) => {
        const code = ev?.error || "";
        console.warn(`[captions] error · ${code}`);
        if (code === "no-speech" || code === "aborted") return;
        if (code === "not-allowed" || code === "service-not-allowed") {
          setCaptionsStatus("Live captions blocked — mic access denied or browser policy.");
        } else if (code === "audio-capture") {
          setCaptionsStatus("Live captions can't access the mic right now.");
        } else if (code === "language-not-supported") {
          setCaptionsStatus(
            `Live captions: ${lang} isn't supported. Try switching language above.`
          );
        } else if (code === "network") {
          setCaptionsStatus("Live captions need internet — recording continues without them.");
        } else if (code) {
          setCaptionsStatus(`Live captions: ${code}`);
        }
      };

      recog.onend = () => {
        console.log("[captions] end");
        if (isRecordingRef.current && recognitionRef.current === recog) {
          try {
            recog.start();
            console.log("[captions] restarted");
          } catch {
            // Already running / cleanup in flight.
          }
        }
      };

      recog.start();
      recognitionRef.current = recog;
    } catch (err) {
      console.warn("[captions] start threw", err);
      setCaptionsStatus(
        err instanceof Error
          ? `Live captions failed to start: ${err.message}`
          : "Live captions failed to start."
      );
    }
  }

  function stopLiveCaptions() {
    const recog = recognitionRef.current;
    recognitionRef.current = null;
    if (recog) {
      try { recog.onend = null; } catch {}
      try { recog.onerror = null; } catch {}
      try { recog.stop(); } catch {}
    }
    setInterimTranscript("");
  }

  // ─── Deepgram live streaming ────────────────────────────────────────────
  // Used when Web Speech is unavailable / unreachable. Streams MediaRecorder
  // chunks over a WebSocket and gets real-time transcripts in <500ms.

  async function startDeepgramStream() {
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
        language: "bn",
        model: "nova-3",
        interim_results: "true",
        punctuate: "true",
        smart_format: "true",
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
        for (const blob of deepgramQueue.current) {
          try { ws.send(blob); } catch {}
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
              setResultCount((n) => n + 1);
              console.log(`[deepgram] final «${text}»`);
            } else {
              setInterimTranscript(text);
              setResultCount((n) => n + 1);
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

  function sendChunkToDeepgram(chunk: Blob) {
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

  /**
   * Append a Deepgram final fragment to the editable transcript. We read the
   * authoritative current value from `finalRef.current` (which the textarea
   * keeps in sync), so a user's manual edits are preserved.
   */
  function appendDeepgramFinal(fragment: string) {
    const text = fragment.trim();
    if (!text) return;
    const prev = finalRef.current.trimEnd();
    finalRef.current = (prev ? prev + " " : "") + text;
    setFinalTranscript(finalRef.current);
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

  function switchCaptionsLang(next: "bn-BD" | "en-US") {
    setCaptionsLang(next);
    if (!isRecordingRef.current) return;
    // Hot-swap while recording: stop the current recognizer (and prevent its
    // onend from restarting it on the old language), then start a fresh one.
    const old = recognitionRef.current;
    recognitionRef.current = null;
    if (old) {
      try { old.onend = null; } catch {}
      try { old.onerror = null; } catch {}
      try { old.stop(); } catch {}
    }
    startLiveCaptions(next);
  }

  async function startRecording() {
    setSubmitError(null);
    setAudioBlob(null);
    setFinalTranscript("");
    setInterimTranscript("");
    setResultCount(0);
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
        // Also stream the same chunk to Deepgram for live captions.
        sendChunkToDeepgram(e.data);
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
      stopLiveCaptions();
      stopDeepgramStream();
    };

    isRecordingRef.current = true;
    setRecording(true);
    setElapsed(0);
    // Open the Deepgram live-streaming WebSocket first (async). MediaRecorder
    // chunks fired before the WS is ready are queued and flushed on open.
    startDeepgramStream();
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
    stopLiveCaptions();
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
  }

  function resumeRecording() {
    if (mediaRecorder.current?.state !== "paused") return;
    stopKeepAlive();
    // Safety net: if the socket died despite keepalive, spin up a new one.
    // Note: in this case Deepgram won't decode the post-resume chunks (no
    // header), so transcripts for the continuation segment may be empty.
    if (!deepgramWs.current || deepgramWs.current.readyState !== WebSocket.OPEN) {
      console.warn("[deepgram] socket dropped during pause — reopening (continuation may not transcribe)");
      startDeepgramStream();
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
    setResultCount(0);
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
        <span className="voices-eyebrow">LOADING</span>
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
        <p className="text-sm text-[var(--muted)]">
          Saving your edited transcript — no re-processing needed.
        </p>
      </div>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────

  const liveText = (finalTranscript + " " + interimTranscript).trim();

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 pt-10 pb-16">
      {/* Topic context */}
      <div className="mb-8">
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
        <div className="space-y-6">
          <div>
            <span className="voices-eyebrow">STEP 1 OF 2 · OPTIONAL</span>
            <h2
              className="mt-2 voices-display-bn text-xl sm:text-2xl text-[var(--ink)] bn-text"
              style={{ fontFamily: "Hind Siliguri, sans-serif", fontWeight: 600 }}
            >
              {msgs.record.step1Title}
            </h2>
            <p
              className="mt-1.5 text-sm text-[var(--muted)] bn-text"
              style={{ fontFamily: "Hind Siliguri, sans-serif" }}
            >
              {msgs.record.step1Desc}
              {" "}
              <span className="text-[var(--ink-soft)]">
                Don&apos;t see your view? Skip — the AI will place it after.
              </span>
            </p>
          </div>

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
          ) : (
            <p className="voices-eyebrow">NO CLUSTERS YET — YOU&apos;LL BE THE FIRST.</p>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <Btn
              onClick={() => setStep("record")}
              size="lg"
              variant="accent"
              fullWidth
            >
              <Icon.Mic size={16} sw={2} />
              {selectedClusterId ? msgs.record.next : "Skip & record"}
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

          <div>
            <span className="voices-eyebrow">
              STEP 2 OF 2 · {recording ? "RECORDING" : audioBlob ? "REVIEW" : "TAP TO START"}
            </span>
            <h2
              className="mt-2 voices-display-bn text-xl sm:text-2xl text-[var(--ink)] bn-text"
              style={{ fontFamily: "Hind Siliguri, sans-serif", fontWeight: 600 }}
            >
              {msgs.record.step2Title}
            </h2>
          </div>

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
                      LISTENING · {captionsLang === "bn-BD" ? "বাং" : "EN"}
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
                      PAUSED · EDIT FREELY
                    </span>
                  </>
                ) : audioBlob ? (
                  <>
                    <Icon.Check size={11} sw={2.4} color="var(--accent)" />
                    <span className="voices-eyebrow">CAPTURED</span>
                  </>
                ) : (
                  <>
                    <Icon.Mic size={11} sw={2.2} color="var(--muted)" />
                    <span className="voices-eyebrow">READY</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Language toggle — picks the SpeechRecognition lang */}
                {liveCaptionsSupported !== false && (
                  <div
                    className="flex rounded-[6px] overflow-hidden border"
                    style={{ borderColor: "var(--hairline)" }}
                  >
                    {(["bn-BD", "en-US"] as const).map((l) => {
                      const active = captionsLang === l;
                      return (
                        <button
                          key={l}
                          type="button"
                          onClick={() => switchCaptionsLang(l)}
                          className={clsx(
                            "voices-mono text-[10px] font-semibold px-2 py-1 transition-colors",
                            active
                              ? "bg-[var(--accent)] text-white"
                              : "text-[var(--ink-soft)] hover:bg-[var(--accent-soft)]"
                          )}
                          style={{ letterSpacing: "0.08em" }}
                          aria-pressed={active}
                        >
                          {l === "bn-BD" ? "বাং" : "EN"}
                        </button>
                      );
                    })}
                  </div>
                )}
                {liveText && (
                  <span className="voices-mono text-[10px]" style={{ color: "var(--muted)" }}>
                    {liveText.length}c
                  </span>
                )}
              </div>
            </div>

            {/* Body — editable textarea, captions append into it */}
            <div className="px-4 sm:px-5 py-3" aria-live="polite">
              <textarea
                ref={transcriptScrollRef as unknown as React.RefObject<HTMLTextAreaElement>}
                value={finalTranscript}
                onChange={(e) => {
                  // User edits become the new ground truth. Mirror to the ref
                  // so the next Deepgram-final appends after the edited text.
                  finalRef.current = e.target.value;
                  setFinalTranscript(e.target.value);
                }}
                placeholder={
                  recording
                    ? "শুনছি… কথা বলুন। (Listening — speak now.)"
                    : audioBlob
                      ? "Edit if needed, then tap Send below."
                      : "Tap the mic to start. Your words will appear here — and you can edit them anytime."
                }
                rows={5}
                className="w-full resize-y bg-transparent text-[18px] sm:text-[19px] leading-relaxed bn-text text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none p-0"
                style={{
                  fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif",
                  minHeight: 96,
                  maxHeight: 280,
                }}
              />
              {/* Interim line — what Deepgram thinks you're saying right now */}
              {recording && !paused && interimTranscript && (
                <div
                  className="mt-2 pt-2 border-t flex items-start gap-2"
                  style={{ borderColor: "var(--hairline-soft)" }}
                >
                  <span
                    className="voices-mono text-[10px] font-semibold shrink-0 mt-1"
                    style={{ color: "var(--live)", letterSpacing: "0.1em" }}
                  >
                    →
                  </span>
                  <p
                    className="text-[15px] leading-snug bn-text flex-1 m-0"
                    style={{
                      fontFamily: "Hind Siliguri, sans-serif",
                      color: "var(--ink-soft)",
                      opacity: 0.75,
                    }}
                  >
                    {interimTranscript}
                    <span className="voices-caret" aria-hidden="true" />
                  </p>
                </div>
              )}
            </div>
          </div>

          {(captionsStatus || liveCaptionsSupported === false) && (
            <p
              className="text-[12px] leading-snug text-center px-2"
              style={{
                color: "var(--muted)",
                fontFamily: "Hind Siliguri, sans-serif",
              }}
            >
              {captionsStatus ||
                "Live captions aren't supported in this browser. Audio is being recorded normally — the server will transcribe it."}
            </p>
          )}

          {/* Mic button — start ↔ pause ↔ resume */}
          <div className="flex flex-col items-center gap-3 pt-1">
            <div className="flex items-center gap-4">
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
                    ? "Start recording"
                    : paused
                      ? "Resume recording"
                      : "Pause recording"
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

              {(recording || audioBlob) && (
                <button
                  type="button"
                  onClick={stopRecording}
                  disabled={!recording && !!audioBlob}
                  className="px-4 py-2.5 rounded-[10px] border text-[13px] font-semibold transition-colors voices-mono"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--hairline)",
                    color: "var(--ink)",
                    letterSpacing: "0.06em",
                  }}
                  aria-label="Stop recording (keeps captured audio)"
                >
                  ■ STOP
                </button>
              )}
            </div>

            <p
              className="text-sm font-semibold text-[var(--ink)] bn-text"
              style={{ fontFamily: "Hind Siliguri, sans-serif" }}
            >
              {!recording
                ? audioBlob
                  ? "Tap mic to record more"
                  : "Tap mic to start"
                : paused
                  ? "Paused — tap to resume, edit text above, or Stop"
                  : "Recording — tap to pause"}
            </p>
            <p className="voices-eyebrow">{msgs.record.banglaHint}</p>
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
                  Re-record
                </Btn>
                <Btn
                  onClick={handleProceed}
                  size="md"
                  variant="accent"
                  fullWidth
                  disabled={!finalTranscript.trim()}
                >
                  Send
                  <Icon.ArrowRight size={16} sw={2} />
                </Btn>
              </div>
              {!finalTranscript.trim() && (
                <p
                  className="text-[12px] text-[var(--muted)] text-center"
                  style={{ fontFamily: "Hind Siliguri, sans-serif" }}
                >
                  Edit the transcript above before sending.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
