import { uploadPublicAsset } from "@/lib/b2";
import { db } from "@/lib/db";

export type TopicImageSource = "unsplash" | "xai" | "openai" | "gemini" | "manual";
export type ClusterImageSource = TopicImageSource;

export interface TopicImage {
  url: string;
  alt: string;
  source: TopicImageSource;
  creditName?: string | null;
  creditUrl?: string | null;
  providerId?: string | null;
  color?: string | null;
}

export type ClusterImage = TopicImage;

interface TopicForImage {
  id: string;
  category: string;
  question: string;
  questionEn?: string | null;
  context?: string | null;
}

interface ClusterForImage {
  id: string;
  label: string;
  summary?: string | null;
  topic: TopicForImage;
}

interface ImageRecord {
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageSource?: string | null;
  imageCreditName?: string | null;
  imageCreditUrl?: string | null;
  imageProviderId?: string | null;
  imageColor?: string | null;
}

type TopicImageRecord = ImageRecord;
type ClusterImageRecord = ImageRecord;

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

interface GeneratedImageItem {
  b64_json?: string;
  url?: string;
}

interface ImageGenerationResponse {
  data?: GeneratedImageItem[];
}

interface VisualSubject {
  id: string;
  kind: "topic" | "cluster";
  category: string;
  title: string;
  context?: string | null;
  parentTitle?: string | null;
  assetFolder: "topic-images" | "cluster-images";
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

function compactText(parts: Array<string | null | undefined>, max = 180): string {
  return parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, max)
    .trim();
}

function topicSubject(topic: TopicForImage): VisualSubject {
  return {
    id: topic.id,
    kind: "topic",
    category: topic.category,
    title: topic.questionEn || topic.question,
    context: topic.context,
    assetFolder: "topic-images",
  };
}

function clusterSubject(cluster: ClusterForImage): VisualSubject {
  return {
    id: cluster.id,
    kind: "cluster",
    category: cluster.topic.category,
    title: cluster.label,
    context: cluster.summary,
    parentTitle: cluster.topic.questionEn || cluster.topic.question,
    assetFolder: "cluster-images",
  };
}

function imageAlt(subject: VisualSubject): string {
  return compactText(
    [
      "Cartoon illustration for",
      subject.kind === "cluster" ? subject.title : null,
      subject.kind === "cluster" ? "opinion cluster in" : null,
      subject.kind === "topic" ? subject.title : subject.parentTitle,
    ],
    220
  );
}

function visualSearchPrompt(subject: VisualSubject): string {
  const category = categoryQueries[subject.category] ?? "public discussion Bangladesh";
  return compactText(
    [
      subject.title,
      subject.parentTitle,
      subject.context,
      category,
      "cartoon illustration vector people friendly editorial",
    ],
    220
  );
}

interface TranslateProvider {
  id: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel: string;
  baseUrl: string;
}

const translateProviders: TranslateProvider[] = [
  {
    id: "deepseek",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    modelEnv: "DEEPSEEK_TEXT_MODEL",
    defaultModel: "deepseek-chat",
    baseUrl: "https://api.deepseek.com",
  },
  {
    id: "xai_grok",
    apiKeyEnv: "XAI_API_KEY",
    modelEnv: "XAI_TEXT_MODEL",
    defaultModel: "grok-4.3",
    baseUrl: "https://api.x.ai/v1",
  },
  {
    id: "openai",
    apiKeyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_TEXT_MODEL",
    defaultModel: "gpt-5.4-mini",
    baseUrl: "https://api.openai.com/v1",
  },
];

function translateProviderOrder(): TranslateProvider[] {
  const configured = (process.env.AI_TEXT_PROVIDER_ORDER ?? "deepseek,xai_grok,openai")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const byId = new Map(translateProviders.map((p) => [p.id, p]));
  const ordered = configured
    .map((name) => byId.get(name))
    .filter((p): p is TranslateProvider => Boolean(p));
  return ordered.length > 0 ? ordered : translateProviders;
}

async function translateSubjectToEnglishKeywords(
  subject: VisualSubject
): Promise<string | null> {
  const source = compactText(
    [
      subject.title,
      subject.parentTitle,
      subject.context,
    ],
    400
  );
  if (!source) return null;

  const prompt = `Translate the following Bangla text describing a public-opinion topic or stance into 4-8 concise English keywords suitable for a stock-photo search on Unsplash. Focus on the visual concept (people, setting, activity, mood) — not literal word-for-word translation. Do not include the word "cartoon" or "illustration". Return ONLY a JSON object in the shape: {"keywords":"keyword1 keyword2 keyword3"}.

Text:
${source}`;

  for (const provider of translateProviderOrder()) {
    const apiKey = process.env[provider.apiKeyEnv];
    if (!apiKey) continue;

    const model = process.env[provider.modelEnv] ?? provider.defaultModel;
    try {
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You translate Bangla concepts into short English keyword strings for image search. Return only the requested JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 80,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(content) as { keywords?: string };
      const keywords = parsed.keywords?.trim();
      if (keywords) return keywords.slice(0, 120);
    } catch (err) {
      console.warn(`[visual-image] translate via ${provider.id} failed:`, err);
    }
  }

  return null;
}

function generatedImagePrompt(subject: VisualSubject): string {
  const target =
    subject.kind === "cluster"
      ? `Opinion cluster: ${subject.title}
Cluster summary: ${subject.context || "A public opinion cluster"}
Parent topic: ${subject.parentTitle || "Bangladesh public discussion"}`
      : `Topic: ${subject.title}
Context: ${subject.context || "Public opinion in Bangladesh"}`;

  return `Create one landscape cartoon-style editorial illustration for a Bangla public-discussion website.
Style: friendly modern cartoon, soft vector illustration, warm human feeling, clean shapes, expressive people, Bangladesh public-life context, polished app-ready artwork.
Composition: 16:9 landscape, clear focal scene, works as a hero or compact thumbnail.
Restrictions: no text, no letters, no logos, no UI, no watermark-like marks, no photorealism.
Category: ${subject.category}
${target}`;
}

export function visualImageFromRecord(record: ImageRecord): TopicImage | null {
  if (!record.imageUrl || !record.imageAlt || !record.imageSource) return null;
  return {
    url: record.imageUrl,
    alt: record.imageAlt,
    source: record.imageSource as TopicImageSource,
    creditName: record.imageCreditName,
    creditUrl: record.imageCreditUrl,
    providerId: record.imageProviderId,
    color: record.imageColor,
  };
}

export function topicImageFromRecord(topic: TopicImageRecord): TopicImage | null {
  return visualImageFromRecord(topic);
}

export function clusterImageFromRecord(cluster: ClusterImageRecord): ClusterImage | null {
  return visualImageFromRecord(cluster);
}

export function visualImageToData(image: TopicImage) {
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

export function topicImageToData(image: TopicImage) {
  return visualImageToData(image);
}

export function clusterImageToData(image: ClusterImage) {
  return visualImageToData(image);
}

export function isImageSchemaMissing(err: unknown): boolean {
  const e = err as { code?: string; message?: string; meta?: unknown };
  const text = `${e.code ?? ""} ${e.message ?? ""} ${JSON.stringify(e.meta ?? {})}`;
  return (
    text.includes("imageUrl") ||
    text.includes("imageAlt") ||
    text.includes("imageSource") ||
    text.includes("ColumnNotFound")
  );
}

export function isTopicImageSchemaMissing(err: unknown): boolean {
  return isImageSchemaMissing(err);
}

export function isClusterImageSchemaMissing(err: unknown): boolean {
  return isImageSchemaMissing(err);
}

async function imagesByIdsForTable(
  table: "Topic" | "Cluster",
  ids: string[]
): Promise<Record<string, TopicImage | null>> {
  if (ids.length === 0) return {};

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  try {
    const rows = await db.$queryRawUnsafe<Array<ImageRecord & { id: string }>>(
      `SELECT id, "imageUrl", "imageAlt", "imageSource", "imageCreditName", "imageCreditUrl", "imageProviderId", "imageColor"
       FROM "${table}"
       WHERE id IN (${placeholders})`,
      ...ids
    );
    return Object.fromEntries(rows.map((row) => [row.id, visualImageFromRecord(row)]));
  } catch (err) {
    if (isImageSchemaMissing(err)) return {};
    throw err;
  }
}

export function topicImagesByIds(ids: string[]): Promise<Record<string, TopicImage | null>> {
  return imagesByIdsForTable("Topic", ids);
}

export function clusterImagesByIds(ids: string[]): Promise<Record<string, ClusterImage | null>> {
  return imagesByIdsForTable("Cluster", ids);
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
    console.warn("[visual-image] Unsplash download tracking failed:", err);
  }
}

async function searchUnsplash(query: string, accessKey: string): Promise<UnsplashPhoto | null> {
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
  return data.results?.[0] ?? null;
}

async function selectUnsplashImage(subject: VisualSubject): Promise<TopicImage | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  const categoryQuery = categoryQueries[subject.category] || "Bangladesh";
  const translated = await translateSubjectToEnglishKeywords(subject);
  const queries = [
    translated ? compactText([translated, categoryQuery], 160) : null,
    translated,
    visualSearchPrompt(subject),
    compactText([subject.title, categoryQuery, "cartoon illustration"], 120),
    categoryQuery,
  ].filter((q, i, arr): q is string => Boolean(q) && arr.indexOf(q) === i);

  let photo: UnsplashPhoto | null = null;
  for (const query of queries) {
    photo = await searchUnsplash(query, accessKey);
    if (photo) break;
  }

  const imageUrl = photo?.urls?.regular ?? photo?.urls?.full ?? photo?.urls?.small;
  if (!photo || !imageUrl) return null;

  if (photo.links.download_location) {
    await triggerUnsplashDownload(photo.links.download_location, accessKey);
  }

  return {
    url: imageUrl,
    alt: photo.alt_description || photo.description || imageAlt(subject),
    source: "unsplash",
    creditName: photo.user.name ?? "Unsplash photographer",
    creditUrl: withUtm(photo.user.links?.html),
    providerId: photo.id,
    color: photo.color ?? null,
  };
}

async function generatedImageBytes(
  item: GeneratedImageItem
): Promise<{ bytes: Buffer; mimeType: string; ext: "jpg" | "png" | "webp" }> {
  if (item?.b64_json) {
    return {
      bytes: Buffer.from(item.b64_json, "base64"),
      mimeType: "image/jpeg",
      ext: "jpg",
    };
  }

  if (item?.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`Couldn't download generated image (HTTP ${res.status}).`);
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    const ext = mimeType.includes("png")
      ? "png"
      : mimeType.includes("webp")
        ? "webp"
        : "jpg";
    return {
      bytes: Buffer.from(await res.arrayBuffer()),
      mimeType,
      ext,
    };
  }

  throw new Error("Image provider returned no image.");
}

async function uploadGeneratedImage(
  subject: VisualSubject,
  source: "xai" | "openai",
  model: string,
  result: ImageGenerationResponse
): Promise<TopicImage | null> {
  const item = result.data?.[0];
  if (!item) return null;

  const { bytes, mimeType, ext } = await generatedImageBytes(item);
  const key = `${subject.assetFolder}/${subject.id}-${source}-${Date.now()}.${ext}`;
  const url = await uploadPublicAsset(key, bytes, mimeType);

  return {
    url,
    alt: imageAlt(subject),
    source,
    creditName: source === "xai" ? "Grok Imagine" : "OpenAI",
    creditUrl: null,
    providerId: model,
    color: null,
  };
}

async function selectXaiImage(subject: VisualSubject): Promise<TopicImage | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.XAI_IMAGE_MODEL ?? "grok-imagine-image-quality";

  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: generatedImagePrompt(subject),
      n: 1,
      response_format: "b64_json",
      aspect_ratio: "16:9",
      resolution: "1k",
    }),
  });

  const data = (await res.json()) as ImageGenerationResponse & { error?: unknown };
  if (!res.ok) throw new Error(`xAI image generation failed: ${JSON.stringify(data.error)}`);

  return uploadGeneratedImage(subject, "xai", model, data);
}

async function selectOpenAiImage(subject: VisualSubject): Promise<TopicImage | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: generatedImagePrompt(subject),
      n: 1,
      size: "1536x1024",
      quality: "low",
      output_format: "jpeg",
    }),
  });

  const data = (await res.json()) as ImageGenerationResponse & { error?: unknown };
  if (!res.ok) throw new Error(`OpenAI image generation failed: ${JSON.stringify(data.error)}`);

  return uploadGeneratedImage(subject, "openai", model, data);
}

async function selectVisualImage(subject: VisualSubject): Promise<TopicImage | null> {
  const order = (process.env.AI_IMAGE_PROVIDER_ORDER ?? "openai,xai,unsplash")
    .split(",")
    .map((provider) => provider.trim())
    .filter(Boolean);

  for (const provider of order) {
    try {
      if (provider === "openai") {
        const image = await selectOpenAiImage(subject);
        if (image) return image;
      } else if (provider === "xai") {
        const image = await selectXaiImage(subject);
        if (image) return image;
      } else if (provider === "unsplash") {
        const image = await selectUnsplashImage(subject);
        if (image) return image;
      }
    } catch (err) {
      console.warn(`[visual-image] ${provider} image selection failed:`, err);
    }
  }

  return null;
}

export async function selectTopicImage(topic: TopicForImage): Promise<TopicImage | null> {
  return selectVisualImage(topicSubject(topic));
}

export async function selectClusterImage(cluster: ClusterForImage): Promise<ClusterImage | null> {
  return selectVisualImage(clusterSubject(cluster));
}

export async function backfillClusterImagesForTopic(
  topic: TopicForImage,
  clusters: Array<{ id: string; label: string; summary?: string | null; imageUrl?: string | null }>,
  limit = 4
) {
  const candidates = clusters.slice(0, limit).filter((cluster) => !cluster.imageUrl);

  await Promise.allSettled(
    candidates.map(async (cluster) => {
      try {
        const image = await selectClusterImage({
          id: cluster.id,
          label: cluster.label,
          summary: cluster.summary,
          topic,
        });
        if (image) {
          await db.cluster.update({
            where: { id: cluster.id },
            data: clusterImageToData(image),
          });
        }
      } catch (err) {
        if (isImageSchemaMissing(err)) return;
        console.warn(`[cluster-image] image fetch failed for ${cluster.id}:`, err);
      }
    })
  );
}

export async function backfillTopClusterImagesForTopic(topic: TopicForImage, limit = 4) {
  try {
    const clusters = await db.cluster.findMany({
      where: { topicId: topic.id, isMerged: false },
      orderBy: { order: "asc" },
      take: limit,
      select: {
        id: true,
        label: true,
        summary: true,
        imageUrl: true,
      },
    });

    await backfillClusterImagesForTopic(topic, clusters, limit);
  } catch (err) {
    if (isImageSchemaMissing(err)) return;
    console.warn(`[cluster-image] top-cluster backfill failed for topic ${topic.id}:`, err);
  }
}
