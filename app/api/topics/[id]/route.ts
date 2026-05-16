import { db } from "@/lib/db";
import { topicImagesByIds } from "@/lib/topic-image";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      opensAt: true,
      closesAt: true,
      status: true,
      createdByUserId: true,
      createdAt: true,
      clusters: {
        where: { isMerged: false },
        orderBy: { order: "asc" },
        include: {
          votes: { select: { direction: true } },
          takes: {
            where: { isPublished: true, isHidden: false },
            select: { id: true, content: true },
            take: 3,
          },
          _count: { select: { takes: { where: { isPublished: true, isHidden: false } } } },
        },
      },
      _count: { select: { takes: { where: { isPublished: true } } } },
    },
  });

  if (!topic) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const imageMap = await topicImagesByIds([topic.id]);

  return Response.json({
    topic: {
      ...topic,
      clusters: topic.clusters.map((c) => ({
        id: c.id,
        label: c.label,
        summary: c.summary,
        upvotes: c.votes.filter((v) => v.direction === "up").length,
        downvotes: c.votes.filter((v) => v.direction === "down").length,
        takeCount: c._count.takes,
        sampleTakes: c.takes,
      })),
      totalTakes: topic._count.takes,
      image: imageMap[topic.id] ?? null,
    },
  });
}
