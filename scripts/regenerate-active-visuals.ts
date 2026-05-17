/**
 * Force-regenerate visuals for the active topic and its top 4 clusters.
 *
 * Usage: npx tsx scripts/regenerate-active-visuals.ts
 *
 * Unlike backfill-active-visuals.ts, this clears existing cluster image
 * fields first so providers run again even when an image is already cached.
 */

import "dotenv/config";
import { db } from "@/lib/db";
import {
  clusterImageToData,
  selectClusterImage,
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
    console.warn("[visuals] topic image regenerate failed:", err);
  }

  const clusters = await db.cluster.findMany({
    where: { topicId: topic.id, isMerged: false },
    orderBy: { order: "asc" },
    take: 4,
    select: { id: true, label: true, summary: true },
  });

  for (const cluster of clusters) {
    try {
      const image = await selectClusterImage({
        id: cluster.id,
        label: cluster.label,
        summary: cluster.summary,
        topic,
      });
      if (image) {
        await db.cluster.update({
          where: { id: cluster.id },
          data: clusterImageToData(image),
        });
        console.log(
          `[visuals] cluster ${cluster.id} updated · source=${image.source} · credit=${image.creditName ?? "-"}`
        );
      } else {
        console.log(`[visuals] cluster ${cluster.id} got no image from any provider`);
      }
    } catch (err) {
      console.warn(`[visuals] cluster ${cluster.id} regenerate failed:`, err);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
