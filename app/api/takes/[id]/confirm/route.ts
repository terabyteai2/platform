import { db } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { assignClusterFromTranscript } from "@/lib/ai/cluster-assignment";
import { moderateTake } from "@/lib/ai/providers";
import { z } from "zod";

const schema = z.object({
  content: z.string().min(1).max(2000),
  clusterId: z.string().optional(),
  newClusterLabel: z.string().max(120).optional(),
  newClusterSummary: z.string().optional(),
  isAnon: z.boolean().optional(),
});

async function upsertAgreeVote(clusterId: string | null, userId: string | null) {
  if (!clusterId || !userId) return;
  await db.vote.upsert({
    where: { clusterId_userId: { clusterId, userId } },
    create: { clusterId, userId, direction: "up" },
    update: { direction: "up" },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserId();

  const take = await db.take.findUnique({
    where: { id },
    include: {
      topic: { include: { clusters: { where: { isMerged: false } } } },
      user: { select: { displayName: true } },
    },
  });

  if (!take) return Response.json({ error: "Not found" }, { status: 404 });
  if (take.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (take.isPublished) return Response.json({ error: "Already published" }, { status: 409 });
  if (take.topic.status !== "live") return Response.json({ error: "Topic not live" }, { status: 403 });
  if (!take.user.displayName?.trim()) {
    return Response.json({ error: "Name required before saving a review" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { content, clusterId, isAnon } = parsed.data;
  let newClusterLabel = parsed.data.newClusterLabel;
  let newClusterSummary = parsed.data.newClusterSummary;
  const publishAnon = isAnon ?? false;

  // Moderation
  const modResult = await moderateTake(id, content).catch((err) => {
    console.warn(`[confirm] moderation failed for ${id}; allowing submit:`, err);
    return { is_safe: true, reason: null };
  });
  if (!modResult.is_safe) {
    await db.take.update({
      where: { id },
      data: { isFlagged: true, moderationReason: modResult.reason },
    });
    await db.moderationEvent.create({
      data: {
        takeId: id,
        reason: modResult.reason ?? "Auto-flagged",
        action: "flagged",
      },
    });
    return Response.json({ flagged: true, reason: modResult.reason }, { status: 422 });
  }

  let finalClusterId = clusterId ?? null;

  if (!finalClusterId && !newClusterLabel?.trim() && content.trim()) {
    try {
      const result = await assignClusterFromTranscript({
        takeId: id,
        topicId: take.topicId,
        transcript: content,
        clusters: take.topic.clusters,
      });
      finalClusterId = result?.clusterId ?? null;
      if (result?.isNew && result.cluster) {
        newClusterLabel = result.cluster.label;
        newClusterSummary = result.cluster.summary ?? undefined;
      }
    } catch (err) {
      console.warn(`[confirm] clusterTake failed for ${id}; publishing without cluster:`, err);
    }
  }

  // If AI fails without proposing a new cluster, fall back to any cluster the
  // user picked before recording.
  if (!finalClusterId && !newClusterLabel?.trim()) {
    finalClusterId = take.clusterId;
  }

  // Handle new cluster creation
  if (!finalClusterId && newClusterLabel) {
    const pendingCount = await db.take.count({
      where: {
        topicId: take.topicId,
        isPending: true,
        cluster: { label: newClusterLabel },
      },
    });

    if (pendingCount < 4) {
      // Still pending — create cluster but mark take as pending
      const newCluster = await db.cluster.create({
        data: {
          topicId: take.topicId,
          label: newClusterLabel,
          summary: newClusterSummary ?? null,
          isAiSeeded: false,
          order: 999,
        },
      });
      finalClusterId = newCluster.id;

      await db.take.update({
        where: { id },
        data: {
          content,
          clusterId: finalClusterId,
          isAnon: publishAnon,
          isPending: true,
          isPublished: false,
        },
      });
      await upsertAgreeVote(finalClusterId, userId);

      return Response.json({
        published: false,
        pending: true,
        message: "মতামত প্রক্রিয়াধীন। আরও কয়েকটি মতামত জমা হলে এটি প্রকাশিত হবে।",
      });
    }
  }

  // Publish
  await db.take.update({
    where: { id },
    data: {
      content,
      clusterId: finalClusterId,
      isAnon: publishAnon,
      isPending: false,
      isPublished: true,
    },
  });
  await upsertAgreeVote(finalClusterId, userId);

  return Response.json({ published: true, takeId: id });
}
