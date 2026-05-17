/**
 * Dev-only shortcut: find or create the admin user in the DB and print a
 * one-liner you can paste into the browser console at http://localhost:3000
 * to sign in without going through the magic-link email flow.
 *
 * Usage: npx tsx scripts/dev-admin-login.ts
 *
 * The admin email is read from ADMIN_EMAILS (first entry).
 */

import "dotenv/config";
import { db } from "@/lib/db";

async function main() {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    console.error("[dev-admin-login] ADMIN_EMAILS is not set in .env");
    process.exitCode = 1;
    return;
  }

  const email = adminEmails[0];

  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        isAnon: false,
        displayName: "Admin",
      },
    });
    console.log(`[dev-admin-login] created admin user · ${email}`);
  } else {
    console.log(`[dev-admin-login] using existing user · ${email}`);
  }

  const cookieValue = `voices_session=${user.id}; path=/; max-age=2592000; samesite=lax`;

  console.log("\nPaste this into the browser console at http://localhost:3000:");
  console.log("---------------------------------------------------------------");
  console.log(`document.cookie = "${cookieValue}";`);
  console.log("---------------------------------------------------------------");
  console.log("\nThen reload and visit /admin/compose or /admin/queue.");
  console.log(`(User id: ${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
