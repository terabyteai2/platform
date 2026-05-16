import { db } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { uploadAudio } from "@/lib/b2";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB hard cap for a 60s clip

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserId();

  const take = await db.take.findUnique({ where: { id } });
  if (!take) return Response.json({ error: "Not found" }, { status: 404 });
  if (take.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0) {
    return Response.json({ error: "Empty audio" }, { status: 400 });
  }
  if (buf.length > MAX_BYTES) {
    return Response.json({ error: "Audio too large" }, { status: 413 });
  }

  const contentType = req.headers.get("content-type") || "audio/webm";
  const publicPath = await uploadAudio(id, buf, contentType);

  return Response.json({ publicPath });
}
