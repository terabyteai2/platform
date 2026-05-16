import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { v4 as uuid } from "uuid";

const SESSION_COOKIE = "voices_session";
const ANON_COOKIE = "voices_anon";

export async function getOrCreateUser(): Promise<{
  userId: string;
  isAnon: boolean;
}> {
  const cookieStore = await cookies();

  // Authenticated session
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    const user = await db.user.findFirst({
      where: { id: sessionToken },
    });
    if (user) return { userId: user.id, isAnon: user.isAnon };
  }

  // Anonymous session — create once per browser
  const anonId = cookieStore.get(ANON_COOKIE)?.value;
  if (anonId) {
    const user = await db.user.findFirst({ where: { id: anonId } });
    if (user) return { userId: user.id, isAnon: true };
  }

  // Brand new anon user
  const newUser = await db.user.create({
    data: { isAnon: true },
  });

  return { userId: newUser.id, isAnon: true };
}

export function setAnonCookie(userId: string): Record<string, string> {
  return {
    [ANON_COOKIE]: userId,
  };
}

export async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
    const anonToken = cookieStore.get(ANON_COOKIE)?.value;
    return sessionToken ?? anonToken ?? null;
  } catch {
    return null;
  }
}

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return false;

  const user = await db.user.findFirst({ where: { id: sessionToken } });
  if (!user?.email) return false;

  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());
  return adminEmails.includes(user.email);
}

export function generateToken(): string {
  return uuid();
}
