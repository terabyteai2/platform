import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { z } from "zod";

const patchSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  isMerged: z.boolean().optional(),
  order: z.number().int().min(0).max(999).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const cluster = await db.cluster.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      label: true,
      summary: true,
      isAiSeeded: true,
      isMerged: true,
      order: true,
    },
  });

  return Response.json({ cluster });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const takes = await db.take.findMany({
    where: { clusterId: id },
    select: { id: true },
  });
  const takeIds = takes.map((t) => t.id);

  await db.$transaction([
    db.moderationEvent.updateMany({
      where: { clusterId: id },
      data: { clusterId: null },
    }),
    db.vote.deleteMany({ where: { clusterId: id } }),
    db.take.updateMany({
      where: { clusterId: id },
      data: { clusterId: null, aiSuggestedClusterId: null },
    }),
    db.moderationEvent.updateMany({
      where: { takeId: { in: takeIds } },
      data: { takeId: null },
    }),
    db.cluster.updateMany({
      where: { mergedIntoId: id },
      data: { mergedIntoId: null },
    }),
    db.cluster.delete({ where: { id } }),
  ]);

  return Response.json({ success: true });
}
