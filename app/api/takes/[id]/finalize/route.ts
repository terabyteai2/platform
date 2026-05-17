import { db } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { transcribe, type AudioInput } from "@/lib/ai/transcribe";
import { assignClusterFromTranscript } from "@/lib/ai/cluster-assignment";
import { getSignedDownloadUrl, isLocalPath } from "@/lib/b2";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  audioPath: z.string(),
  durationMs: z.number().optional(),
  // Browser-side transcript captured via Web Speech API. Used as a fallback
  // when server-side transcription also fails to produce anything.
  clientTranscript: z.string().optional(),
});

type AsrProviderValue = "deepgram" | "speechmatics" | "fallback";

/**
 * Load the audio bytes for a take. Local-fs paths are read from
 * public/uploads; other paths (signed B2 URLs etc.) are fetched.
 */
async function loadAudio(storagePath: string): Promise<AudioInput> {
  if (isLocalPath(storagePath)) {
    const rel = storagePath.slice("local:".length);
    const filePath = path.join(process.cwd(), "public", "uploads", rel);
    const buf = await fs.readFile(filePath);
    return {
      bytes: new Uint8Array(buf),
      contentType: "audio/webm",
      // No public URL we can hand to URL-only providers; that's OK, the
      // bytes-mode providers (Deepgram, Cloudflare) work without one.
    };
  }
  const url = await getSignedDownloadUrl(storagePath);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Couldn't fetch audio (HTTP ${r.status})`);
  const buf = new Uint8Array(await r.arrayBuffer());
  return {
    bytes: buf,
    contentType: r.headers.get("content-type") || "audio/webm",
    url,
  };
}

async function tryTranscribe(
  audioPath: string,
  takeId: string
): Promise<{ transcript: string; confidence: number | null; provider: AsrProviderValue }> {
  try {
    const audio = await loadAudio(audioPath);
    const res = await transcribe(audio, takeId);
    return {
      transcript: res.transcript,
      confidence: res.confidence,
      provider: res.provider as AsrProviderValue,
    };
  } catch (err) {
    console.warn(`[finalize] transcribe failed for ${takeId}:`, err);
    return { transcript: "", confidence: null, provider: "fallback" };
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserId();

  const take = await db.take.findUnique({
    where: { id },
    include: { topic: { include: { clusters: { where: { isMerged: false } } } } },
  });

  if (!take) return Response.json({ error: "Not found" }, { status: 404 });
  if (take.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { audioPath, durationMs, clientTranscript } = parsed.data;

  // If the client already streamed live captions and has a transcript, trust
  // it as the authoritative content — the user has likely edited it. Skip
  // the server re-transcription pass entirely. We only fall back to server
  // ASR when the client didn't send anything (no live-captions support, etc.).
  let asrTranscript = "";
  let confidence: number | null = null;
  let provider: AsrProviderValue = "fallback";
  const trustClient = !!clientTranscript && clientTranscript.trim().length > 0;
  if (!trustClient) {
    const res = await tryTranscribe(audioPath, id);
    asrTranscript = res.transcript;
    confidence = res.confidence;
    provider = res.provider;
  }

  const transcript = trustClient
    ? clientTranscript!.trim()
    : asrTranscript.trim();
  const finalProvider: AsrProviderValue = trustClient ? "fallback" : provider;

  await db.take.update({
    where: { id },
    data: {
      audioUrl: audioPath,
      durationMs: durationMs ?? null,
      content: transcript,
      asrConfidence: confidence,
      asrProvider: finalProvider,
    },
  });

  const clusters = take.topic.clusters;
  let suggestedClusterId: string | null = null;
  let matchScore = 0;
  let newClusterDraft: { label: string; summary: string } | null = null;

  if (transcript.trim()) {
    try {
      const result = await assignClusterFromTranscript({
        takeId: id,
        topicId: take.topicId,
        transcript,
        clusters,
      });
      suggestedClusterId = result?.clusterId ?? null;
      matchScore = result?.matchScore ?? 0;
      if (result?.isNew && result.cluster) {
        newClusterDraft = {
          label: result.cluster.label,
          summary: result.cluster.summary ?? "",
        };
      }
    } catch (err) {
      console.warn(`[finalize] clusterTake failed for ${id}:`, err);
    }
  }

  return Response.json({
    takeId: id,
    transcript,
    confidence,
    provider: finalProvider,
    suggestedClusterId,
    matchScore,
    newClusterDraft,
    clusters: clusters.map((c) => ({ id: c.id, label: c.label })),
  });
}
