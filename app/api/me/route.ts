import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { z } from "zod";

const ANON_COOKIE = "voices_anon";

function publicUser(u: { id: string; displayName: string | null; isAnon: boolean; email: string | null }) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const isAdmin = !!u.email && adminEmails.includes(u.email);
  return {
    id: u.id,
    displayName: u.displayName,
    isAnon: u.isAnon,
    isAdmin,
  };
}

export async function GET() {
  const { userId } = await getOrCreateUser();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return Response.json({ user: null }, { status: 404 });

  const res = Response.json({ user: publicUser(user) });
  // getOrCreateUser may have just created a brand-new anonymous row — make
  // sure the cookie travels back with this response so subsequent requests
  // stick to the same user.
  const c = await cookies();
  if (user.isAnon && c.get(ANON_COOKIE)?.value !== user.id) {
    res.headers.append(
      "Set-Cookie",
      `${ANON_COOKIE}=${user.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
    );
  }
  return res;
}

const patchSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Name can't be empty")
    .max(40, "Name is too long")
    .nullable()
    .optional(),
});

export async function PATCH(req: Request) {
  const { userId } = await getOrCreateUser();
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const current = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const displayName =
    parsed.data.displayName === null || parsed.data.displayName === undefined
      ? null
      : parsed.data.displayName;

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      displayName,
      isAnon: current?.email ? false : displayName === null,
    },
  });

  const res = Response.json({ user: publicUser(updated) });
  const c = await cookies();
  if (!c.get("voices_session") && c.get(ANON_COOKIE)?.value !== userId) {
    res.headers.append(
      "Set-Cookie",
      `${ANON_COOKIE}=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
    );
  }
  return res;
}
