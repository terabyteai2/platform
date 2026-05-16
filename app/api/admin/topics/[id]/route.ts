import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { z } from "zod";

const patchSchema = z.object({
  question: z.string().max(200).optional(),
  questionEn: z.string().max(200).optional(),
  context: z.string().optional(),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
  status: z.enum(["draft", "scheduled", "live", "closed"]).optional(),
  category: z.enum(["work", "tech", "society", "cities", "local"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.opensAt) data.opensAt = new Date(data.opensAt as string);
  if (data.closesAt) data.closesAt = new Date(data.closesAt as string);

  const topic = await db.topic.update({
    where: { id },
    data,
    select: {
      id: true,
      week: true,
      category: true,
      question: true,
      questionEn: true,
      context: true,
      opensAt: true,
      closesAt: true,
      status: true,
      createdAt: true,
    },
  });
  return Response.json({ topic });
}
