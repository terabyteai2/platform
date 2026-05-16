import { db } from "@/lib/db";
import { getOrCreateUser, setAnonCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, isAnon } = await getOrCreateUser();

  const topic = await db.topic.findFirst({
    where: { status: "live" },
    orderBy: { week: "desc" },
    include: {
      clusters: {
        where: { isMerged: false },
        orderBy: { order: "asc" },
        include: {
          votes: { select: { direction: true } },
          takes: {
            where: { isPublished: true, isHidden: false },
            select: { id: true, content: true, isAnon: true, user: { select: { displayName: true } } },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          _count: { select: { takes: { where: { isPublished: true, isHidden: false } } } },
        },
      },
      _count: { select: { takes: { where: { isPublished: true } } } },
    },
  });

  if (!topic) {
    return Response.json({ topic: null }, { status: 200 });
  }

  // Get user's votes
  const userVotes = await db.vote.findMany({
    where: { userId, clusterId: { in: topic.clusters.map((c) => c.id) } },
    select: { clusterId: true, direction: true },
  });
  const voteMap = Object.fromEntries(userVotes.map((v) => [v.clusterId, v.direction]));

  const clusters = topic.clusters.map((c) => ({
    id: c.id,
    label: c.label,
    summary: c.summary,
    isAiSeeded: c.isAiSeeded,
    order: c.order,
    upvotes: c.votes.filter((v) => v.direction === "up").length,
    downvotes: c.votes.filter((v) => v.direction === "down").length,
    takeCount: c._count.takes,
    sampleTakes: c.takes.map((t) => ({
      id: t.id,
      content: t.content.slice(0, 200),
      author: t.isAnon ? null : t.user?.displayName ?? null,
    })),
    userVote: voteMap[c.id] ?? null,
  }));

  const headers: Record<string, string> = {};
  if (isAnon) {
    headers["Set-Cookie"] = `voices_anon=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
  }

  return Response.json(
    {
      topic: {
        id: topic.id,
        week: topic.week,
        category: topic.category,
        question: topic.question,
        questionEn: topic.questionEn,
        context: topic.context,
        opensAt: topic.opensAt,
        closesAt: topic.closesAt,
        status: topic.status,
        totalTakes: topic._count.takes,
        clusters,
      },
      userId,
    },
    { headers }
  );
}
