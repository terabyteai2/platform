import { db } from "@/lib/db";
import { Resend } from "resend";
import { z } from "zod";
import { v4 as uuid } from "uuid";

const schema = z.object({ email: z.string().email() });

const tokens = new Map<string, { email: string; expiresAt: number }>();

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid email" }, { status: 400 });

  const { email } = parsed.data;
  const token = uuid();
  tokens.set(token, { email, expiresAt: Date.now() + 15 * 60 * 1000 });

  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/verify?token=${token}`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Voices <noreply@voices.app>",
    to: email,
    subject: "Voices-এ লগইন করুন",
    html: `<p>নিচের লিঙ্কে ক্লিক করে লগইন করুন (১৫ মিনিটের জন্য সক্রিয়):</p><a href="${url}">${url}</a>`,
  });

  return Response.json({ sent: true });
}
