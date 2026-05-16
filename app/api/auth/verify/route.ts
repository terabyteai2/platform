import { db } from "@/lib/db";
import { redirect } from "next/navigation";

// Reuse the same in-memory map (works for single-process; replace with Redis for multi-pod)
declare global {
  // eslint-disable-next-line no-var
  var __magicTokens: Map<string, { email: string; expiresAt: number }> | undefined;
}
const tokens: Map<string, { email: string; expiresAt: number }> =
  globalThis.__magicTokens ?? (globalThis.__magicTokens = new Map());

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) return new Response("Invalid token", { status: 400 });

  const entry = tokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    return new Response("Token expired or not found", { status: 400 });
  }

  tokens.delete(token);

  let user = await db.user.findUnique({ where: { email: entry.email } });
  if (!user) {
    user = await db.user.create({
      data: { email: entry.email, isAnon: false },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": `voices_session=${user.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    },
  });
}
