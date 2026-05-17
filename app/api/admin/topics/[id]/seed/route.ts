import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { seedClusters } from "@/lib/ai/providers";
import {
  backfillClusterImagesForTopic,
  selectTopicImage,
  topicImageToData,
} from "@/lib/topic-image";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const topic = await db.topic.findUnique({
    where: { id },
    select: { question: true, questionEn: true, context: true, category: true, imageUrl: true },
  });
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

  // Best-effort: fetch a cartoon-style image if the topic doesn't already have
  // one. Skipped if the topic already has imageUrl set so an admin "re-seed"
  // doesn't overwrite a manually-chosen image.
  if (!topic.imageUrl) {
    try {
      const image = await selectTopicImage({
        id,
        category: topic.category,
        question: topic.question,
        questionEn: topic.questionEn,
        context: topic.context,
      });
      if (image) {
        await db.topic.update({ where: { id }, data: topicImageToData(image) });
      }
    } catch (err) {
      console.warn(`[admin/seed] image fetch failed for ${id}:`, err);
    }
  }

  await backfillClusterImagesForTopic(
    {
      id,
      category: topic.category,
      question: topic.question,
      questionEn: topic.questionEn,
      context: topic.context,
    },
    clusters.map((cluster) => ({
      id: cluster.id,
      label: cluster.label,
      summary: cluster.summary,
      imageUrl: null,
    })),
    4
  );

  return Response.json({ clusters });
}
