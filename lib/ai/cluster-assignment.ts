import { db } from "@/lib/db";
import { clusterTake } from "@/lib/ai/providers";

interface ClusterCandidate {
  id: string;
  label: string;
  summary?: string | null;
}

interface AssignClusterOptions {
  takeId: string;
  topicId: string;
  transcript: string;
  clusters: ClusterCandidate[];
}

export interface ClusterAssignment {
  clusterId: string | null;
  matchScore: number;
  isNew: boolean;
  cluster?: { id: string; label: string; summary?: string | null } | null;
}

export async function assignClusterFromTranscript({
  takeId,
  topicId,
  transcript,
  clusters,
}: AssignClusterOptions): Promise<ClusterAssignment | null> {
  const trimmed = transcript.trim();
  if (!trimmed) return null;

  const result = await clusterTake(takeId, trimmed, clusters);
  let clusterId: string | null = null;
  let assignedCluster: ClusterAssignment["cluster"] = null;
  let isNew = false;

  if (result.clusterId === "new" && result.newClusterDraft) {
    const count = await db.cluster.count({ where: { topicId } });
    const cluster = await db.cluster.create({
      data: {
        topicId,
        label: result.newClusterDraft.label,
        summary: result.newClusterDraft.summary,
        isAiSeeded: false,
        order: count,
      },
      select: { id: true, label: true, summary: true },
    });
    clusterId = cluster.id;
    assignedCluster = cluster;
    isNew = true;
  } else {
    const existing = clusters.find((cluster) => cluster.id === result.clusterId);
    if (existing) {
      clusterId = existing.id;
      assignedCluster = {
        id: existing.id,
        label: existing.label,
        summary: existing.summary,
      };
    }
  }

  await db.take.update({
    where: { id: takeId },
    data: {
      clusterId,
      aiMatchScore: result.matchScore,
      aiSuggestedClusterId: clusterId,
    },
  });

  return {
    clusterId,
    matchScore: result.matchScore,
    isNew,
    cluster: assignedCluster,
  };
}
