import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { getUploadUrl } from "@/lib/b2";
import { z } from "zod";

const schema = z.object({
  topicId: z.string(),
  clusterId: z.string().optional(),
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
      { error: "Name required before saving a review" },
      { status: 400, headers }
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400, headers });
  }

  const { topicId, clusterId } = parsed.data;

  const topic = await db.topic.findUnique({ where: { id: topicId } });
  if (!topic || topic.status !== "live") {
    return Response.json({ error: "Topic not live" }, { status: 403, headers });
  }

  const take = await db.take.create({
    data: {
      topicId,
      clusterId: clusterId ?? null,
      userId,
      content: "",
      isAnon,
      isPending: true,
    },
  });

  const { uploadUrl, publicPath } = await getUploadUrl(take.id);

  return Response.json({ takeId: take.id, uploadUrl, publicPath }, { headers });
}
