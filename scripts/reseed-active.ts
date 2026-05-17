/**
 * One-shot re-seed of the active topic's clusters via configured AI providers.
 *
 * Usage:  npx tsx scripts/reseed-active.ts
 *
 * Mirrors the logic of app/api/admin/topics/[id]/seed/route.ts but skips the
 * admin auth check. Use only on trusted environments.
 */

import "dotenv/config";
import { db } from "@/lib/db";
import { seedClusters } from "@/lib/ai/providers";
import {
  backfillClusterImagesForTopic,
  selectTopicImage,
  topicImageToData,
} from "@/lib/topic-image";

/** Retry a Prisma query on connection-class errors (Neon free-tier wake-up). */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const code = (err as { code?: string }).code;
      const isTransient =
        code === "ETIMEDOUT" || code === "ENETUNREACH" || code === "ECONNREFUSED";
      console.warn(`[reseed] ${label} attempt ${i} failed (${code ?? "?"}); ${isTransient ? "retrying" : "giving up"}...`);
      if (!isTransient) break;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw last;
}

async function main() {
  const topic = await withRetry("find active topic", () =>
    db.topic.findFirst({
      where: { status: "live" },
      orderBy: { week: "desc" },
      select: { id: true, week: true, question: true, questionEn: true, context: true, category: true },
    })
  );

  if (!topic) {
    console.error("No live topic to re-seed.");
    process.exit(1);
  }

  console.log(`[reseed] week ${topic.week} · id=${topic.id}`);
  console.log(`[reseed] question: ${topic.question.slice(0, 80)}...`);

  console.log(`[reseed] calling seedClusters()...`);
  const drafts = await seedClusters(topic.id, topic.question, topic.context);
  console.log(`[reseed] received ${drafts.length} drafts`);
  drafts.forEach((d, i) => console.log(`  ${i + 1}. ${d.label}`));

  console.log(`[reseed] removing existing AI-seeded clusters...`);
  const removed = await withRetry("delete existing AI clusters", () =>
    db.cluster.deleteMany({ where: { topicId: topic.id, isAiSeeded: true } })
  );
  console.log(`[reseed] deleted ${removed.count} old clusters`);

  console.log(`[reseed] inserting new clusters...`);
  const clusters = await withRetry("insert new clusters", () =>
    db.$transaction(
      drafts.map((draft, i) =>
        db.cluster.create({
          data: {
            topicId: topic.id,
            label: draft.label,
            summary: draft.summary,
            isAiSeeded: true,
            order: i,
          },
        })
      )
    )
  );
  console.log(`[reseed] inserted ${drafts.length} fresh clusters · isAiSeeded=true`);

  console.log(`[reseed] selecting cluster images...`);
  await backfillClusterImagesForTopic(
    topic,
    clusters.map((cluster) => ({
      id: cluster.id,
      label: cluster.label,
      summary: cluster.summary,
      imageUrl: null,
    })),
    4
  );
  console.log(`[reseed] cluster image backfill attempted for top 4 clusters`);

  // Try fetching a topic image while we're here — same pipeline that should
  // soon fire automatically.
  console.log(`[reseed] selecting topic image...`);
  try {
    const image = await selectTopicImage({
      id: topic.id,
      category: topic.category,
      question: topic.question,
      questionEn: topic.questionEn,
      context: topic.context,
    });
    if (image) {
      await withRetry("update topic with image", () =>
        db.topic.update({ where: { id: topic.id }, data: topicImageToData(image) })
      );
      console.log(`[reseed] image set · source=${image.source} · ${image.url.slice(0, 80)}`);
    } else {
      console.log(`[reseed] no image returned from configured image providers`);
    }
  } catch (err) {
    console.warn(`[reseed] image selection failed (non-fatal):`, err);
  }

  console.log(`[reseed] done.`);
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
