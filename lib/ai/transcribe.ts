import { db } from "@/lib/db";
import { AsrProvider } from "@/app/generated/prisma/enums";

interface TranscribeResult {
  transcript: string;
  confidence: number;
  provider: AsrProvider;
  durationMs?: number;
}

async function transcribeDeepgram(
  audioUrl: string,
  takeId: string
): Promise<TranscribeResult> {
  const t0 = Date.now();
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?language=bn&model=nova-3&punctuate=true&smart_format=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: audioUrl }),
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
      errorReason: res.ok ? null : JSON.stringify(data),
      requestPayload: { url: audioUrl },
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
  audioUrl: string,
  takeId: string
): Promise<TranscribeResult> {
  const t0 = Date.now();

  // Submit job
  const submitRes = await fetch(
    "https://asr.api.speechmatics.com/v2/jobs/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SPEECHMATICS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config: {
          type: "transcription",
          transcription_config: { language: "bn" },
        },
        url: audioUrl,
      }),
    }
  );

  if (!submitRes.ok) throw new Error("Speechmatics submit failed");
  const { id: jobId } = await submitRes.json();

  // Poll for completion (max 30s for 60s audio)
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(
      `https://asr.api.speechmatics.com/v2/jobs/${jobId}`,
      {
        headers: { Authorization: `Bearer ${process.env.SPEECHMATICS_API_KEY}` },
      }
    );
    const status = await statusRes.json();
    if (status.job?.status === "done") {
      const transcriptRes = await fetch(
        `https://asr.api.speechmatics.com/v2/jobs/${jobId}/transcript?format=txt`,
        {
          headers: {
            Authorization: `Bearer ${process.env.SPEECHMATICS_API_KEY}`,
          },
        }
      );
      const transcript = await transcriptRes.text();
      const latency = Date.now() - t0;

      await db.aiCall.create({
        data: {
          takeId,
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
  audioUrl: string,
  takeId: string
): Promise<TranscribeResult> {
  const t0 = Date.now();

  // Download audio to send as bytes (Cloudflare Workers AI requires bytes)
  const audioRes = await fetch(audioUrl);
  const audioBuffer = await audioRes.arrayBuffer();

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/openai/whisper-large-v3-turbo`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
      body: audioBuffer,
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
      errorReason: res.ok ? null : JSON.stringify(data),
      requestPayload: { url: audioUrl },
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
  audioUrl: string,
  takeId: string
): Promise<TranscribeResult> {
  try {
    return await transcribeDeepgram(audioUrl, takeId);
  } catch (err) {
    console.error("Deepgram failed:", err);
  }
  if (process.env.SPEECHMATICS_API_KEY) {
    try {
      return await transcribeSpeechmatics(audioUrl, takeId);
    } catch (err) {
      console.error("Speechmatics failed:", err);
    }
  }
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
    return await transcribeCloudflare(audioUrl, takeId);
  }
  throw new Error("All ASR providers failed or unavailable");
}
