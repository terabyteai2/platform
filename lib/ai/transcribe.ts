import { db } from "@/lib/db";
import { AsrProvider } from "@/app/generated/prisma/enums";

export interface TranscribeResult {
  transcript: string;
  confidence: number;
  provider: AsrProvider;
  durationMs?: number;
}

export interface AudioInput {
  bytes: Uint8Array;
  contentType: string; // e.g. "audio/webm"
  // Optional — used by Speechmatics which requires a fetchable URL. When
  // present and publicly reachable, we can use URL mode; otherwise we fall
  // back to bytes-mode providers only.
  url?: string;
}

async function transcribeDeepgram(
  audio: AudioInput,
  takeId: string
): Promise<TranscribeResult> {
  const t0 = Date.now();
  // Deepgram accepts raw audio bytes in the request body. This avoids the
  // "Deepgram fetches the URL itself" path which requires public reachability.
  // Force Bangla. nova-3 supports `bn`; `detect_language` was misclassifying
  // short clips as English so we don't use it. Lock the language explicitly.
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?language=bn&model=nova-3&punctuate=true&smart_format=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": audio.contentType || "audio/webm",
      },
      body: audio.bytes as BodyInit,
    }
  );

  const latency = Date.now() - t0;
  const data = await res.json();

  await db.aiCall.create({
    data: {
      takeId,
      provider: "deepgram",
      purpose: "transcribe",
      latencyMs: latency,
      success: res.ok,
      errorReason: res.ok ? null : JSON.stringify(data).slice(0, 1000),
      requestPayload: {
        mode: "bytes",
        bytes: audio.bytes.byteLength,
        contentType: audio.contentType,
      },
      responsePayload: data,
    },
  });

  if (!res.ok) throw new Error("Deepgram error: " + JSON.stringify(data));

  const alt = data?.results?.channels?.[0]?.alternatives?.[0];
  return {
    transcript: alt?.transcript ?? "",
    confidence: alt?.confidence ?? 0,
    provider: AsrProvider.deepgram,
  };
}

async function transcribeSpeechmatics(
  audio: AudioInput,
  takeId: string
): Promise<TranscribeResult> {
  if (!audio.url) {
    throw new Error("Speechmatics requires a publicly fetchable URL");
  }
  const audioUrl = audio.url;
  const t0 = Date.now();

  const submitRes = await fetch("https://asr.api.speechmatics.com/v2/jobs/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SPEECHMATICS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      config: { type: "transcription", transcription_config: { language: "bn" } },
      url: audioUrl,
    }),
  });

  if (!submitRes.ok) throw new Error("Speechmatics submit failed");
  const { id: jobId } = await submitRes.json();

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(`https://asr.api.speechmatics.com/v2/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${process.env.SPEECHMATICS_API_KEY}` },
    });
    const status = await statusRes.json();
    if (status.job?.status === "done") {
      const transcriptRes = await fetch(
        `https://asr.api.speechmatics.com/v2/jobs/${jobId}/transcript?format=txt`,
        { headers: { Authorization: `Bearer ${process.env.SPEECHMATICS_API_KEY}` } }
      );
      const transcript = await transcriptRes.text();
      const latency = Date.now() - t0;

      await db.aiCall.create({
        data: {
          takeId,
          // AiProvider enum only has deepgram/gemini_flash; bucket
          // speechmatics under deepgram for telemetry purposes.
          provider: "deepgram",
          purpose: "transcribe",
          latencyMs: latency,
          success: true,
          errorReason: null,
          requestPayload: { url: audioUrl },
          responsePayload: { transcript },
        },
      });

      return { transcript, confidence: 0.8, provider: AsrProvider.speechmatics };
    }
    if (status.job?.status === "rejected") throw new Error("Speechmatics rejected");
  }
  throw new Error("Speechmatics timeout");
}

async function transcribeCloudflare(
  audio: AudioInput,
  takeId: string
): Promise<TranscribeResult> {
  const t0 = Date.now();

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/openai/whisper-large-v3-turbo`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
      body: audio.bytes as BodyInit,
    }
  );

  const latency = Date.now() - t0;
  const data = await res.json();

  await db.aiCall.create({
    data: {
      takeId,
      // Same — AiProvider enum is narrow; log Cloudflare under deepgram.
      provider: "deepgram",
      purpose: "transcribe",
      latencyMs: latency,
      success: res.ok,
      errorReason: res.ok ? null : JSON.stringify(data).slice(0, 1000),
      requestPayload: { mode: "bytes", bytes: audio.bytes.byteLength },
      responsePayload: data,
    },
  });

  if (!res.ok) throw new Error("Cloudflare AI error: " + JSON.stringify(data));

  return {
    transcript: data?.result?.text ?? "",
    confidence: 0.65,
    provider: AsrProvider.fallback,
  };
}

export async function transcribe(
  audio: AudioInput,
  takeId: string
): Promise<TranscribeResult> {
  try {
    return await transcribeDeepgram(audio, takeId);
  } catch (err) {
    console.error("[transcribe] Deepgram failed:", err);
  }
  if (process.env.SPEECHMATICS_API_KEY && audio.url) {
    try {
      return await transcribeSpeechmatics(audio, takeId);
    } catch (err) {
      console.error("[transcribe] Speechmatics failed:", err);
    }
  }
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
    return await transcribeCloudflare(audio, takeId);
  }
  throw new Error("All ASR providers failed or unavailable");
}
