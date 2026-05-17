import { getUserId } from "@/lib/auth";
import { assignClusterFromTranscript } from "@/lib/ai/cluster-assignment";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  content: z.string().min(1).max(2000).optional(),
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
  if (take.isPublished) return Response.json({ error: "Already published" }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const content = parsed.data.content?.trim() || take.content.trim();
  if (!content) return Response.json({ error: "Transcript required" }, { status: 400 });

  let result;
  try {
    result = await assignClusterFromTranscript({
      takeId: id,
      topicId: take.topicId,
      transcript: content,
      clusters: take.topic.clusters,
    });
  } catch (err) {
    console.warn(`[takes/cluster] AI clustering failed for ${id}:`, err);
    return Response.json(
      { error: err instanceof Error ? err.message : "AI clustering failed" },
      { status: 502 }
    );
  }

  return Response.json({ result });
}
