import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { seedClusters } from "@/lib/ai/gemini";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const topic = await db.topic.findUnique({ where: { id } });
  if (!topic) return Response.json({ error: "Not found" }, { status: 404 });

  const drafts = await seedClusters(id, topic.question, topic.context);

  // Delete existing AI-seeded clusters (preserve manual ones)
  await db.cluster.deleteMany({ where: { topicId: id, isAiSeeded: true } });

  const clusters = await db.$transaction(
    drafts.map((draft, i) =>
      db.cluster.create({
        data: {
          topicId: id,
          label: draft.label,
          summary: draft.summary,
          isAiSeeded: true,
          order: i,
        },
      })
    )
  );

  return Response.json({ clusters });
}
