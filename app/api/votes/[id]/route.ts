import { db } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const vote = await db.vote.findUnique({ where: { id } });
  if (!vote || vote.userId !== userId) {
    return Response.json({ error: "Vote not found" }, { status: 404 });
  }

  await db.vote.delete({ where: { id } });
  return Response.json({ success: true });
}
