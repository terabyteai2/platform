import { db } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { transcribe } from "@/lib/ai/transcribe";
import { clusterTake } from "@/lib/ai/gemini";
import { getSignedDownloadUrl } from "@/lib/b2";
import { z } from "zod";

const schema = z.object({
  audioPath: z.string(),
  durationMs: z.number().optional(),
});

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

  const { audioPath, durationMs } = parsed.data;
  const signedUrl = await getSignedDownloadUrl(audioPath);

  // Transcribe
  const { transcript, confidence, provider } = await transcribe(signedUrl, id);

  // Update take with audio info + transcript
  await db.take.update({
    where: { id },
    data: {
      audioUrl: audioPath,
      durationMs: durationMs ?? null,
      content: transcript,
      asrConfidence: confidence,
      asrProvider: provider,
    },
  });

  // Cluster
  const clusters = take.topic.clusters;
  let suggestedClusterId: string | null = null;
  let matchScore = 0;
  let newClusterDraft: { label: string; summary: string } | null = null;

  if (transcript.trim() && clusters.length > 0) {
    const result = await clusterTake(id, transcript, clusters);
    matchScore = result.matchScore;

    if (result.clusterId === "new" && result.newClusterDraft) {
      newClusterDraft = result.newClusterDraft;
      suggestedClusterId = null;
    } else {
      suggestedClusterId = result.clusterId;
    }

    await db.take.update({
      where: { id },
      data: {
        aiMatchScore: matchScore,
        aiSuggestedClusterId: suggestedClusterId,
      },
    });
  }

  return Response.json({
    takeId: id,
    transcript,
    confidence,
    provider,
    suggestedClusterId,
    matchScore,
    newClusterDraft,
    clusters: clusters.map((c) => ({ id: c.id, label: c.label })),
  });
}
