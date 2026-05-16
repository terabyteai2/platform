import { db } from "@/lib/db";
import { isAdmin, getUserId } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["approve", "hide", "dismiss"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const moderatorUserId = await getUserId();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid action" }, { status: 400 });

  const { action } = parsed.data;

  const updateData: Record<string, unknown> = { isFlagged: false };
  if (action === "hide") updateData.isHidden = true;
  if (action === "approve") updateData.isPublished = true;

  await db.take.update({ where: { id }, data: updateData });

  await db.moderationEvent.create({
    data: {
      takeId: id,
      reason: `Moderator action: ${action}`,
      action:
        action === "approve"
          ? "approved"
          : action === "hide"
          ? "hidden"
          : "dismissed",
      moderatorUserId,
    },
  });

  return Response.json({ success: true });
}
