import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { z } from "zod";

const patchSchema = z.object({
  week: z.number().int().positive().optional(),
  question: z.string().max(200).optional(),
  questionEn: z.string().max(200).optional(),
  context: z.string().optional(),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
  status: z.enum(["draft", "scheduled", "live", "closed"]).optional(),
  category: z.enum(["work", "tech", "society", "cities", "local"]).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const topic = await db.topic.findUnique({
    where: { id },
    select: {
      id: true,
      week: true,
      category: true,
      question: true,
      questionEn: true,
      context: true,
      imageUrl: true,
      imageAlt: true,
      imageSource: true,
      imageCreditName: true,
      imageCreditUrl: true,
      imageColor: true,
      opensAt: true,
      closesAt: true,
      status: true,
      createdAt: true,
      clusters: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          label: true,
          summary: true,
          imageUrl: true,
          imageAlt: true,
          imageSource: true,
          imageCreditName: true,
          imageCreditUrl: true,
          imageColor: true,
          isAiSeeded: true,
          isMerged: true,
          order: true,
          _count: { select: { takes: true, votes: true } },
        },
      },
      takes: {
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          content: true,
          clusterId: true,
          audioUrl: true,
          durationMs: true,
          isAnon: true,
          isHidden: true,
          isFlagged: true,
          isPublished: true,
          isPending: true,
          asrConfidence: true,
          createdAt: true,
          user: { select: { displayName: true, isAnon: true, email: true } },
        },
      },
      _count: { select: { takes: true } },
    },
  });

  if (!topic) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ topic });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.opensAt) data.opensAt = new Date(data.opensAt as string);
  if (data.closesAt) data.closesAt = new Date(data.closesAt as string);

  if (parsed.data.status === "live") {
    await db.topic.updateMany({
      where: { status: "live", id: { not: id } },
      data: { status: "closed" },
    });
  }

  const topic = await db.topic.update({
    where: { id },
    data,
    select: {
      id: true,
      week: true,
      category: true,
      question: true,
      questionEn: true,
      context: true,
      opensAt: true,
      closesAt: true,
      status: true,
      createdAt: true,
    },
  });
  return Response.json({ topic });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const clusters = await db.cluster.findMany({
    where: { topicId: id },
    select: { id: true },
  });
  const clusterIds = clusters.map((c) => c.id);

  const takes = await db.take.findMany({
    where: { topicId: id },
    select: { id: true },
  });
  const takeIds = takes.map((t) => t.id);

  await db.$transaction([
    db.moderationEvent.deleteMany({
      where: { OR: [{ takeId: { in: takeIds } }, { clusterId: { in: clusterIds } }] },
    }),
    db.aiCall.deleteMany({ where: { OR: [{ takeId: { in: takeIds } }, { topicId: id }] } }),
    db.vote.deleteMany({ where: { clusterId: { in: clusterIds } } }),
    db.take.deleteMany({ where: { topicId: id } }),
    db.cluster.updateMany({
      where: { mergedIntoId: { in: clusterIds } },
      data: { mergedIntoId: null },
    }),
    db.cluster.deleteMany({ where: { topicId: id } }),
    db.topic.delete({ where: { id } }),
  ]);

  return Response.json({ success: true });
}
