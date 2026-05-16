import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import {
  isTopicImageSchemaMissing,
  selectTopicImage,
  topicImageFromRecord,
  topicImagesByIds,
  topicImageToData,
  type TopicImage,
} from "@/lib/topic-image";
import { z } from "zod";

const schema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("auto"),
  }),
  z.object({
    mode: z.literal("manual"),
    imageUrl: z.string().url(),
    imageAlt: z.string().trim().min(1).max(240),
    imageCreditName: z.string().trim().max(120).optional(),
    imageCreditUrl: z.string().trim().url().optional().or(z.literal("")),
  }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const topic = await db.topic.findUnique({
    where: { id },
    select: {
      id: true,
      category: true,
      question: true,
      questionEn: true,
      context: true,
    },
  });
  if (!topic) return Response.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.mode === "manual") {
    const image: TopicImage = {
      url: parsed.data.imageUrl,
      alt: parsed.data.imageAlt,
      source: "manual",
      creditName: parsed.data.imageCreditName || null,
      creditUrl: parsed.data.imageCreditUrl || null,
      providerId: null,
      color: null,
    };
    let updated;
    try {
      updated = await db.topic.update({
        where: { id },
        data: topicImageToData(image),
      });
    } catch (err) {
      if (isTopicImageSchemaMissing(err)) {
        return Response.json(
          { error: "Topic image columns are not in the database yet. Run npm run db:push." },
          { status: 409 }
        );
      }
      throw err;
    }
    return Response.json({ image: topicImageFromRecord(updated) });
  }

  const image = await selectTopicImage(topic);
  if (!image) {
    const imageMap = await topicImagesByIds([id]);
    return Response.json({
      image: imageMap[id] ?? null,
      warning: "No image provider returned a usable image.",
    });
  }

  let updated;
  try {
    updated = await db.topic.update({
      where: { id },
      data: topicImageToData(image),
    });
  } catch (err) {
    if (isTopicImageSchemaMissing(err)) {
      return Response.json(
        { error: "Topic image columns are not in the database yet. Run npm run db:push." },
        { status: 409 }
      );
    }
    throw err;
  }

  return Response.json({ image: topicImageFromRecord(updated) });
}
