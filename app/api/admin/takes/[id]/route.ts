import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { z } from "zod";

const patchSchema = z.object({
  content: z.string().trim().max(5000).optional(),
  clusterId: z.string().nullable().optional(),
  isHidden: z.boolean().optional(),
  isFlagged: z.boolean().optional(),
  isPublished: z.boolean().optional(),
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

  const take = await db.take.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      content: true,
      clusterId: true,
      isHidden: true,
      isFlagged: true,
      isPublished: true,
      isPending: true,
    },
  });

  return Response.json({ take });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  await db.$transaction([
    db.moderationEvent.updateMany({
      where: { takeId: id },
      data: { takeId: null },
    }),
    db.aiCall.updateMany({
      where: { takeId: id },
      data: { takeId: null },
    }),
    db.take.delete({ where: { id } }),
  ]);

  return Response.json({ success: true });
}
