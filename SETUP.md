# Voices — Setup Guide

## 1. Environment variables

Copy `.env.local` and fill in real values:

```

DEEPGRAM_API_KEY=

XAI_API_KEY=
DEEPSEEK_API_KEY=
OPENAI_API_KEY=
UNSPLASH_ACCESS_KEY=
AI_TEXT_PROVIDER_ORDER=xai_grok,deepseek,openai
XAI_TEXT_MODEL=grok-4.3
DEEPSEEK_TEXT_MODEL=deepseek-v4-flash
OPENAI_TEXT_MODEL=gpt-5.4-mini
XAI_IMAGE_MODEL=grok-imagine-image-quality
OPENAI_IMAGE_MODEL=gpt-image-2
AI_IMAGE_PROVIDER_ORDER=openai,xai,unsplash
RESEND_API_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAILS=
```

## 2. Supabase Storage bucket

In Supabase dashboard: Storage → New bucket → `voice-takes` → **Public: off**, then add a policy allowing authenticated inserts via signed URLs.

## 3. Database setup

```bash
npm run db:push      # push schema to your Postgres (first deploy)
npm run db:seed      # seed 1 live topic, 8 clusters, 40 fake takes
```

## 4. Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## 5. Admin access

Visit `/admin/compose` — you'll need to be logged in with an email that matches `ADMIN_EMAILS`. Send yourself a magic link at `/api/auth/magic` (POST with `{ email: "you@..." }`).

## 6. Deploy to Vercel

```bash
vercel --prod
```

Set all env vars in Vercel dashboard or via `vercel env add`. The `vercel.json` maps them to project secrets.

## 7. Weekly topic rotation

Every Friday before 5pm BST (Asia/Dhaka), in `/admin/compose`:
1. Fill in the question + context
2. Click "AI ক্লাস্টার তৈরি করুন" — AI seeds 5-8 Bangla opinion clusters
3. Edit/remove any you don't like
4. Set `closesAt` to Friday 5pm local time
5. Click "Publish (LIVE)"

The previous topic auto-closes when you publish a new one.

## Architecture notes

- **AI pipeline:** every ASR and AI call is logged to `AiCall` table with latency, payload, and success flag — use Prisma Studio (`npm run db:studio`) to debug
- **Fallback chain:** Deepgram → Speechmatics → Cloudflare Whisper
- **Cluster threshold:** a new user-proposed cluster only appears publicly after 5 takes match it; below that the take shows as "pending" to the author only
- **Anonymous sessions:** set via `voices_anon` cookie (httpOnly, 1-year expiry) — no account needed to vote
