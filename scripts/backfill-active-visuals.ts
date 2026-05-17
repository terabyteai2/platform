/**
 * One-shot visual backfill for the active topic.
 *
 * Usage: npx tsx scripts/backfill-active-visuals.ts
 *
 * Regenerates the active topic visual and fills missing visuals for the first
 * four active clusters. It does not reseed, delete, or reorder clusters.
 */

import "dotenv/config";
import { db } from "@/lib/db";
import {
  backfillTopClusterImagesForTopic,
  selectTopicImage,
  topicImageToData,
} from "@/lib/topic-image";

async function main() {
  const topic = await db.topic.findFirst({
    where: { status: "live" },
    orderBy: { week: "desc" },
    select: {
      id: true,
      week: true,
      category: true,
      question: true,
      questionEn: true,
      context: true,
    },
  });

  if (!topic) {
    console.log("[visuals] No live topic found.");
    return;
  }

  console.log(`[visuals] active topic week ${topic.week} · ${topic.id}`);

  try {
    const image = await selectTopicImage(topic);
    if (image) {
      await db.topic.update({
        where: { id: topic.id },
        data: topicImageToData(image),
      });
      console.log(`[visuals] topic image updated · source=${image.source}`);
    } else {
      console.log("[visuals] no topic image returned by configured providers");
    }
  } catch (err) {
    console.warn("[visuals] topic image backfill failed:", err);
  }

  await backfillTopClusterImagesForTopic(topic, 4);
  console.log("[visuals] top cluster image backfill attempted");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
