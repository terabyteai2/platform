import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  clusterId: z.string(),
  direction: z.enum(["up", "down"]),
});

export async function POST(req: Request) {
  const { userId, isAnon } = await getOrCreateUser();
  const headers: Record<string, string> = {};
  if (isAnon) {
    headers["Set-Cookie"] = `voices_anon=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });
  if (!user?.displayName?.trim()) {
    return Response.json(
      { error: "Name required before voting" },
      { status: 400, headers }
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400, headers });
  }

  const { clusterId, direction } = parsed.data;

  // Verify cluster belongs to a live topic
  const cluster = await db.cluster.findUnique({
    where: { id: clusterId },
    include: { topic: { select: { status: true } } },
  });

  if (!cluster) {
    return Response.json({ error: "Cluster not found" }, { status: 404, headers });
  }
  if (cluster.topic.status !== "live") {
    return Response.json({ error: "Topic is not live" }, { status: 403, headers });
  }

  const vote = await db.vote.upsert({
    where: { clusterId_userId: { clusterId, userId } },
    create: { clusterId, userId, direction },
    update: { direction },
  });

  return Response.json({ vote }, { headers });
}
