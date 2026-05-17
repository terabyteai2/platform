import { getUserId } from "@/lib/auth";
import { getSignedDownloadUrl, isLocalPath } from "@/lib/b2";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserId();

  const take = await db.take.findUnique({
    where: { id },
    select: {
      audioUrl: true,
      userId: true,
      isPublished: true,
      isHidden: true,
    },
  });

  if (!take?.audioUrl) {
    return Response.json({ error: "Audio not found" }, { status: 404 });
  }
  if (take.userId !== userId && (!take.isPublished || take.isHidden)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isLocalPath(take.audioUrl)) {
    const rel = take.audioUrl.slice("local:".length);
    return Response.redirect(new URL(`/uploads/${rel}`, req.url), 302);
  }

  const url = await getSignedDownloadUrl(take.audioUrl);
  return Response.redirect(url, 302);
}
