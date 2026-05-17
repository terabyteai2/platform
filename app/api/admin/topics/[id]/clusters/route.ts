import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  label: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(2000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const topic = await db.topic.findUnique({ where: { id }, select: { id: true } });
  if (!topic) return Response.json({ error: "Topic not found" }, { status: 404 });

  const last = await db.cluster.findFirst({
    where: { topicId: id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const cluster = await db.cluster.create({
    data: {
      topicId: id,
      label: parsed.data.label,
      summary: parsed.data.summary || null,
      isAiSeeded: false,
      order: (last?.order ?? -1) + 1,
    },
    select: {
      id: true,
      label: true,
      summary: true,
      isAiSeeded: true,
      isMerged: true,
      order: true,
    },
  });

  return Response.json({ cluster }, { status: 201 });
}
