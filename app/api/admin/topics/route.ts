import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  week: z.number().int().positive(),
  category: z.enum(["work", "tech", "society", "cities", "local"]).default("society"),
  question: z.string().min(5).max(200),
  questionEn: z.string().max(200).optional(),
  context: z.string().optional(),
  opensAt: z.string(),
  closesAt: z.string(),
});

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const topic = await db.topic.create({
    data: {
      ...parsed.data,
      opensAt: new Date(parsed.data.opensAt),
      closesAt: new Date(parsed.data.closesAt),
      status: "draft",
    },
  });

  return Response.json({ topic }, { status: 201 });
}

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const topics = await db.topic.findMany({
    orderBy: { week: "desc" },
    include: {
      _count: { select: { takes: true, clusters: true } },
    },
  });

  return Response.json({ topics });
}
