import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const topic = await db.topic.findUnique({
    where: { id },
    include: {
      clusters: {
        where: { isMerged: false },
        orderBy: { order: "asc" },
        include: {
          votes: { select: { direction: true } },
          takes: {
            where: { isPublished: true, isHidden: false },
            select: { id: true, content: true, asrConfidence: true },
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

  const totalVoices = topic._count.takes;

  const results = topic.clusters.map((c) => {
    const upvotes = c.votes.filter((v) => v.direction === "up").length;
    const downvotes = c.votes.filter((v) => v.direction === "down").length;
    const takeCount = c._count.takes;
    const pct = totalVoices > 0 ? Math.round((takeCount / totalVoices) * 100) : 0;

    // Featured quote: highest confidence take
    const featuredTake = c.takes.reduce<{ content: string } | null>((best, t) => {
      if (!best) return t;
      return (t.asrConfidence ?? 0) > ((best as { asrConfidence?: number }).asrConfidence ?? 0)
        ? t
        : best;
    }, null);

    return {
      id: c.id,
      label: c.label,
      summary: c.summary,
      upvotes,
      downvotes,
      takeCount,
      pct,
      featuredQuote: featuredTake?.content?.slice(0, 200) ?? null,
    };
  });

  return Response.json({
    topicId: id,
    totalVoices,
    results: results.sort((a, b) => b.takeCount - a.takeCount),
    closesAt: topic.closesAt,
    status: topic.status,
  });
}
