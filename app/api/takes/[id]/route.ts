import { db } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserId();

  const take = await db.take.findUnique({
    where: { id },
    include: { cluster: { select: { id: true, label: true } } },
  });

  if (!take) return Response.json({ error: "Not found" }, { status: 404 });
  if (take.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  return Response.json({ take });
}

const patchSchema = z.object({
  content: z.string().optional(),
  clusterId: z.string().optional(),
  isAnon: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserId();

  const take = await db.take.findUnique({ where: { id } });
  if (!take) return Response.json({ error: "Not found" }, { status: 404 });
  if (take.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (take.isPublished) return Response.json({ error: "Already published" }, { status: 409 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const updated = await db.take.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json({ take: updated });
}
