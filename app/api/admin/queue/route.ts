import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [flagged, pendingClusters] = await Promise.all([
    db.take.findMany({
      where: { isFlagged: true, isHidden: false },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        cluster: { select: { label: true } },
        user: { select: { displayName: true, isAnon: true } },
      },
    }),
    db.cluster.findMany({
      where: {
        takes: { some: { isPending: true } },
        isAiSeeded: false,
      },
      include: {
        _count: { select: { takes: { where: { isPending: true } } } },
        topic: { select: { question: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return Response.json({ flagged, pendingClusters });
}
