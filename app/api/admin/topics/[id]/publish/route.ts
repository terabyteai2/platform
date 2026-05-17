import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import {
  backfillTopClusterImagesForTopic,
  selectTopicImage,
  topicImageToData,
} from "@/lib/topic-image";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["scheduled", "live"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid status" }, { status: 400 });

  // Ensure no other topic is live
  if (parsed.data.status === "live") {
    await db.topic.updateMany({
      where: { status: "live", id: { not: id } },
      data: { status: "closed" },
    });
  }

  const topic = await db.topic.update({
    where: { id },
    data: { status: parsed.data.status },
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
      imageUrl: true,
    },
  });

  // Last chance to give the topic a cartoon-style image before it goes live. Non-fatal.
  if (!topic.imageUrl) {
    try {
      const image = await selectTopicImage({
        id: topic.id,
        category: topic.category,
        question: topic.question,
        questionEn: topic.questionEn,
        context: topic.context,
      });
      if (image) {
        await db.topic.update({ where: { id: topic.id }, data: topicImageToData(image) });
      }
    } catch (err) {
      console.warn(`[admin/publish] image fetch failed for ${topic.id}:`, err);
    }
  }

  await backfillTopClusterImagesForTopic(
    {
      id: topic.id,
      category: topic.category,
      question: topic.question,
      questionEn: topic.questionEn,
      context: topic.context,
    },
    4
  );

  return Response.json({ topic });
}
