import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["scheduled", "live"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid status" }, { status: 400 });

  // Ensure no other topic is live
  if (parsed.data.status === "live") {
    await db.topic.updateMany({
      where: { status: "live", id: { not: id } },
      data: { status: "closed" },
    });
  }

  const topic = await db.topic.update({
    where: { id },
    data: { status: parsed.data.status },
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
