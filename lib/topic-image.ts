import { GoogleGenAI, Modality } from "@google/genai";
import { uploadPublicAsset } from "@/lib/b2";
import { db } from "@/lib/db";

export type TopicImageSource = "unsplash" | "gemini" | "manual";

export interface TopicImage {
  url: string;
  alt: string;
  source: TopicImageSource;
  creditName?: string | null;
  creditUrl?: string | null;
  providerId?: string | null;
  color?: string | null;
}

interface TopicForImage {
  id: string;
  category: string;
  question: string;
  questionEn?: string | null;
  context?: string | null;
}

interface TopicImageRecord {
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageSource?: string | null;
  imageCreditName?: string | null;
  imageCreditUrl?: string | null;
  imageProviderId?: string | null;
  imageColor?: string | null;
}

interface UnsplashPhoto {
  id: string;
  color?: string | null;
  description?: string | null;
  alt_description?: string | null;
  urls: { regular?: string; full?: string; small?: string };
  links: { download_location?: string };
  user: {
    name?: string | null;
    links?: { html?: string | null };
  };
}

const categoryQueries: Record<string, string> = {
  work: "workplace jobs workers Bangladesh",
  tech: "technology digital life Bangladesh",
  society: "people community society Bangladesh",
  cities: "city street urban Bangladesh",
  local: "local neighborhood community Bangladesh",
};

function withUtm(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "voices_discussion_platform");
    u.searchParams.set("utm_medium", "referral");
    return u.toString();
  } catch {
    return url;
  }
}

function compactText(parts: Array<string | null | undefined>, max = 160): string {
  return parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, max)
    .trim();
}

function imageAlt(topic: TopicForImage): string {
  return compactText(
    ["Editorial image for", topic.questionEn || topic.question],
    220
  );
}

function visualPrompt(topic: TopicForImage): string {
  const category = categoryQueries[topic.category] ?? "public discussion Bangladesh";
  return compactText([topic.questionEn, topic.question, topic.context, category], 220);
}

export function topicImageFromRecord(topic: TopicImageRecord): TopicImage | null {
  if (!topic.imageUrl || !topic.imageAlt || !topic.imageSource) return null;
  return {
    url: topic.imageUrl,
    alt: topic.imageAlt,
    source: topic.imageSource as TopicImageSource,
    creditName: topic.imageCreditName,
    creditUrl: topic.imageCreditUrl,
    providerId: topic.imageProviderId,
    color: topic.imageColor,
  };
}

export function topicImageToData(image: TopicImage) {
  return {
    imageUrl: image.url,
    imageAlt: image.alt,
    imageSource: image.source,
    imageCreditName: image.creditName ?? null,
    imageCreditUrl: image.creditUrl ?? null,
    imageProviderId: image.providerId ?? null,
    imageColor: image.color ?? null,
  };
}

export function isTopicImageSchemaMissing(err: unknown): boolean {
  const e = err as { code?: string; message?: string; meta?: unknown };
  const text = `${e.code ?? ""} ${e.message ?? ""} ${JSON.stringify(e.meta ?? {})}`;
  return (
    text.includes("imageUrl") ||
    text.includes("imageAlt") ||
    text.includes("imageSource") ||
    text.includes("ColumnNotFound")
  );
}

export async function topicImagesByIds(ids: string[]): Promise<Record<string, TopicImage | null>> {
  if (ids.length === 0) return {};

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  try {
    const rows = await db.$queryRawUnsafe<Array<TopicImageRecord & { id: string }>>(
      `SELECT id, "imageUrl", "imageAlt", "imageSource", "imageCreditName", "imageCreditUrl", "imageProviderId", "imageColor"
       FROM "Topic"
       WHERE id IN (${placeholders})`,
      ...ids
    );
    return Object.fromEntries(rows.map((row) => [row.id, topicImageFromRecord(row)]));
  } catch (err) {
    if (isTopicImageSchemaMissing(err)) return {};
    throw err;
  }
}

async function triggerUnsplashDownload(downloadLocation: string, accessKey: string) {
  try {
    const url = new URL(downloadLocation);
    if (!url.searchParams.has("client_id")) {
      url.searchParams.set("client_id", accessKey);
    }
    await fetch(url, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
    });
  } catch (err) {
    console.warn("[topic-image] Unsplash download tracking failed:", err);
  }
}

async function selectUnsplashImage(topic: TopicForImage): Promise<TopicImage | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  const query = visualPrompt(topic) || categoryQueries[topic.category] || "Bangladesh";
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");
  url.searchParams.set("per_page", "1");

  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1",
    },
  });
  if (!res.ok) throw new Error(`Unsplash image search failed (HTTP ${res.status}).`);

  const data = (await res.json()) as { results?: UnsplashPhoto[] };
  const photo = data.results?.[0];
  const imageUrl = photo?.urls?.regular ?? photo?.urls?.full ?? photo?.urls?.small;
  if (!photo || !imageUrl) return null;

  if (photo.links.download_location) {
    await triggerUnsplashDownload(photo.links.download_location, accessKey);
  }

  return {
    url: imageUrl,
    alt: photo.alt_description || photo.description || imageAlt(topic),
    source: "unsplash",
    creditName: photo.user.name ?? "Unsplash photographer",
    creditUrl: withUtm(photo.user.links?.html),
    providerId: photo.id,
    color: photo.color ?? null,
  };
}

async function selectGeminiImage(topic: TopicForImage): Promise<TopicImage | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
  const prompt = `Create one landscape editorial image for a Bangla public-discussion website.
Style: sophisticated documentary/editorial visual, realistic or subtly illustrative, warm natural light, no text, no logos, no UI, no watermark-like text.
Topic: ${topic.questionEn || topic.question}
Context: ${topic.context || "Public opinion in Bangladesh"}
Category: ${topic.category}
Use a 16:9 composition that can sit above a news-style topic headline.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  const inlineData = imagePart?.inlineData;
  if (!inlineData?.data) return null;

  const mimeType = inlineData.mimeType ?? "image/png";
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
  const bytes = Buffer.from(inlineData.data, "base64");
  const key = `topic-images/${topic.id}-${Date.now()}.${ext}`;
  const url = await uploadPublicAsset(key, bytes, mimeType);

  return {
    url,
    alt: imageAlt(topic),
    source: "gemini",
    creditName: "Gemini",
    creditUrl: null,
    providerId: model,
    color: null,
  };
}

export async function selectTopicImage(topic: TopicForImage): Promise<TopicImage | null> {
  try {
    const unsplash = await selectUnsplashImage(topic);
    if (unsplash) return unsplash;
  } catch (err) {
    console.warn("[topic-image] Unsplash selection failed:", err);
  }

  try {
    const gemini = await selectGeminiImage(topic);
    if (gemini) return gemini;
  } catch (err) {
    console.warn("[topic-image] Gemini image generation failed:", err);
  }

  return null;
}
