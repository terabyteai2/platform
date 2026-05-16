import { db } from "@/lib/db";
import { TopicCategory } from "@/app/generated/prisma/enums";
import { topicImagesByIds } from "@/lib/topic-image";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cat = searchParams.get("cat") as TopicCategory | null;
  const cursor = searchParams.get("cursor");

  const topics = await db.topic.findMany({
    where: {
      status: "closed",
      ...(cat ? { category: cat } : {}),
    },
    orderBy: { week: "desc" },
    take: 12,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      week: true,
      category: true,
      question: true,
      questionEn: true,
      closesAt: true,
      _count: { select: { takes: { where: { isPublished: true } } } },
      clusters: {
        where: { isMerged: false },
        orderBy: { order: "asc" },
        take: 3,
        select: { id: true, label: true },
      },
    },
  });

  const nextCursor = topics.length === 12 ? topics[topics.length - 1].id : null;
  const imageMap = await topicImagesByIds(topics.map((t) => t.id));

  return Response.json({
    topics: topics.map((t) => ({
      id: t.id,
      week: t.week,
      category: t.category,
      question: t.question,
      questionEn: t.questionEn,
      closesAt: t.closesAt,
      totalTakes: t._count.takes,
      image: imageMap[t.id] ?? null,
      topClusters: t.clusters,
    })),
    nextCursor,
  });
}
