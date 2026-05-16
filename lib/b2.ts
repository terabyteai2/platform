import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { promises as fs } from "node:fs";
import path from "node:path";

const BUCKET = process.env.B2_BUCKET!;
const REGION = process.env.B2_REGION ?? "us-east-005";
const ENDPOINT = `https://${process.env.B2_ENDPOINT}`;

// Local-fallback config. When B2 is unreachable (e.g. on a restricted dev
// network), we write the audio to public/uploads/takes/<id>.webm so the rest
// of the flow keeps working. Paths stored on takes are prefixed with
// "local:" so getSignedDownloadUrl knows which branch to take.
const LOCAL_PREFIX = "local:";
const LOCAL_DIR = path.join(process.cwd(), "public", "uploads", "takes");

function isConnectivityError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; name?: string; errors?: unknown[] };
  if (e.code === "ETIMEDOUT" || e.code === "ENETUNREACH" || e.code === "ECONNREFUSED" || e.code === "EAI_AGAIN") {
    return true;
  }
  if (e.name === "TimeoutError" || e.name === "AggregateError") return true;
  if (Array.isArray(e.errors)) {
    return e.errors.some(isConnectivityError);
  }
  return false;
}

function getClient() {
  return new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: process.env.B2_KEY_ID!,
      secretAccessKey: process.env.B2_APP_KEY!,
    },
  });
}

export function isLocalPath(p: string): boolean {
  return p.startsWith(LOCAL_PREFIX);
}

async function writeLocal(takeId: string, body: Uint8Array | Buffer): Promise<string> {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const filePath = path.join(LOCAL_DIR, `${takeId}.webm`);
  await fs.writeFile(filePath, body);
  return `${LOCAL_PREFIX}takes/${takeId}.webm`;
}

export async function getUploadUrl(
  takeId: string
): Promise<{ uploadUrl: string; publicPath: string }> {
  const client = getClient();
  const key = `takes/${takeId}.webm`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: "audio/webm",
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

  return { uploadUrl, publicPath: key };
}

/**
 * Server-side upload — bypasses browser CORS by relaying through Next.js.
 * Tries B2 first; if the host is unreachable (no outbound connectivity,
 * misconfigured endpoint, etc.) falls back to writing the file under
 * public/uploads/takes/ so dev flows keep working.
 */
export async function uploadAudio(
  takeId: string,
  body: Uint8Array | Buffer,
  contentType = "audio/webm"
): Promise<string> {
  const forceLocal = process.env.STORAGE_DRIVER === "local";
  const hasB2Creds =
    !!process.env.B2_BUCKET &&
    !!process.env.B2_ENDPOINT &&
    !!process.env.B2_KEY_ID &&
    !!process.env.B2_APP_KEY;

  if (!forceLocal && hasB2Creds) {
    try {
      const client = getClient();
      const key = `takes/${takeId}.webm`;
      await client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );
      return key;
    } catch (err) {
      if (!isConnectivityError(err)) throw err;
      console.warn(
        `[storage] B2 unreachable, falling back to local fs for take ${takeId}.`
      );
    }
  }

  return writeLocal(takeId, body);
}

// Cache for the auto-detected ngrok tunnel URL. Looked up once per process.
let cachedPublicBase: string | null | undefined;

async function detectPublicBase(): Promise<string | null> {
  if (cachedPublicBase !== undefined) return cachedPublicBase;
  if (process.env.PUBLIC_BASE_URL) {
    cachedPublicBase = process.env.PUBLIC_BASE_URL;
    return cachedPublicBase;
  }
  // Try the local ngrok API. If ngrok is running, this returns the public URL
  // of any active tunnel — perfect for letting remote ASR providers fetch
  // locally-stored audio without manual env config.
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 500);
    const r = await fetch("http://127.0.0.1:4040/api/tunnels", { signal: controller.signal });
    clearTimeout(t);
    if (!r.ok) {
      cachedPublicBase = null;
      return null;
    }
    const d = (await r.json()) as { tunnels?: Array<{ public_url?: string; proto?: string }> };
    const https = d.tunnels?.find((t) => t.proto === "https")?.public_url;
    cachedPublicBase = https ?? null;
    return cachedPublicBase;
  } catch {
    cachedPublicBase = null;
    return null;
  }
}

export async function getSignedDownloadUrl(storagePath: string): Promise<string> {
  if (isLocalPath(storagePath)) {
    // Local file — needs a publicly reachable URL for remote ASR providers.
    // Prefer PUBLIC_BASE_URL → ngrok auto-detect → localhost (which only works
    // if the ASR provider can somehow reach the dev machine).
    const base = (await detectPublicBase()) ?? "http://localhost:3000";
    const rel = storagePath.slice("local:".length);
    return `${base.replace(/\/$/, "")}/uploads/${rel}`;
  }

  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: storagePath,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}
