import { getUserId } from "@/lib/auth";

/**
 * Returns a Deepgram credential the browser can use to open a live-streaming
 * WebSocket. For now this returns the long-lived API key directly — only
 * safe for development. For production, replace with one of:
 *
 *   - A Deepgram temporary token (`/v1/auth/grant`) — requires a higher-scope
 *     parent API key than the current one (which returned 403 FORBIDDEN).
 *   - A scoped ephemeral project key minted via `/v1/projects/.../keys`.
 *   - A WebSocket proxy on the server side that holds the key.
 */
export async function POST() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return Response.json({ error: "Deepgram not configured" }, { status: 500 });

  return Response.json({
    token: apiKey,
    // Hint to the client about how long it should treat this token as valid.
    // For the long-lived key we just say "until the parent revokes it".
    expiresIn: null,
  });
}
