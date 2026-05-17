import { db } from "@/lib/db";

type AiProviderId = "xai_grok" | "deepseek" | "openai";

interface JsonSchema {
  name: string;
  schema: object;
}

interface AiJsonOptions {
  takeId?: string;
  topicId?: string;
  purpose: "seed" | "cluster" | "moderate";
  requestPayload?: object;
  schema: JsonSchema;
  maxTokens?: number;
}

interface ChatProvider {
  id: AiProviderId;
  label: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel: string;
  baseUrl: string;
  responseFormat: "json_schema" | "json_object";
  maxTokensParam: "max_tokens" | "max_completion_tokens";
}

const chatProviders: ChatProvider[] = [
  {
    id: "xai_grok",
    label: "Grok",
    apiKeyEnv: "XAI_API_KEY",
    modelEnv: "XAI_TEXT_MODEL",
    defaultModel: "grok-4.3",
    baseUrl: "https://api.x.ai/v1",
    responseFormat: "json_schema",
    maxTokensParam: "max_tokens",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    modelEnv: "DEEPSEEK_TEXT_MODEL",
    defaultModel: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    responseFormat: "json_object",
    maxTokensParam: "max_tokens",
  },
  {
    id: "openai",
    label: "OpenAI",
    apiKeyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_TEXT_MODEL",
    defaultModel: "gpt-5.4-mini",
    baseUrl: "https://api.openai.com/v1",
    responseFormat: "json_schema",
    maxTokensParam: "max_completion_tokens",
  },
];

function providerOrder(): ChatProvider[] {
  const configured = (process.env.AI_TEXT_PROVIDER_ORDER ?? "xai_grok,deepseek,openai")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  const byId = new Map(chatProviders.map((provider) => [provider.id, provider]));
  const ordered = configured
    .map((name) => byId.get(name as AiProviderId))
    .filter((provider): provider is ChatProvider => Boolean(provider));

  return ordered.length > 0 ? ordered : chatProviders;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fenced) return JSON.parse(fenced);
    throw new Error("AI response was not valid JSON.");
  }
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

async function logAiCall(
  provider: ChatProvider,
  options: AiJsonOptions,
  latencyMs: number,
  success: boolean,
  requestPayload: object,
  responsePayload: unknown,
  errorReason?: string
) {
  try {
    await db.aiCall.create({
      data: {
        takeId: options.takeId ?? null,
        topicId: options.topicId ?? null,
        provider: provider.id,
        purpose: options.purpose,
        latencyMs,
        success,
        errorReason: success ? null : errorReason?.slice(0, 1000) ?? null,
        requestPayload,
        responsePayload: JSON.parse(JSON.stringify(responsePayload ?? null)),
      },
    });
  } catch (err) {
    console.warn("[ai] telemetry write failed; continuing without AiCall row:", err);
  }
}

async function callProvider<T>(
  provider: ChatProvider,
  prompt: string,
  options: AiJsonOptions
): Promise<T> {
  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) throw new Error(`${provider.label} is not configured.`);

  const model = process.env[provider.modelEnv] ?? provider.defaultModel;
  const requestPayload = options.requestPayload ?? { prompt };
  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are the AI engine for a Bangla public discussion platform. Return only valid JSON matching the requested shape. Do not include markdown.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    [provider.maxTokensParam]: options.maxTokens ?? 1800,
    response_format:
      provider.responseFormat === "json_schema"
        ? {
            type: "json_schema",
            json_schema: {
              name: options.schema.name,
              schema: options.schema.schema,
              strict: true,
            },
          }
        : { type: "json_object" },
  };

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const message = err instanceof Error ? err.message : String(err);
    await logAiCall(
      provider,
      options,
      latencyMs,
      false,
      { ...requestPayload, provider: provider.id, model },
      { error: message },
      message
    );
    throw new Error(`${provider.label} request failed: ${message}`);
  }

  const latencyMs = Date.now() - t0;
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  await logAiCall(
    provider,
    options,
    latencyMs,
    res.ok,
    { ...requestPayload, provider: provider.id, model },
    data,
    res.ok ? undefined : JSON.stringify(data)
  );

  if (!res.ok) {
    throw new Error(`${provider.label} error: ${JSON.stringify(data)}`);
  }

  const choice = (data as { choices?: Array<{ message?: { content?: unknown } }> })
    .choices?.[0];
  const messageText = extractMessageText(choice?.message?.content);
  if (!messageText.trim()) {
    throw new Error(`${provider.label} returned an empty response.`);
  }

  return safeJsonParse(messageText) as T;
}

export async function callAiJson<T>(
  prompt: string,
  options: AiJsonOptions
): Promise<T> {
  const errors: string[] = [];

  for (const provider of providerOrder()) {
    if (!process.env[provider.apiKeyEnv]) {
      errors.push(`${provider.label} skipped: missing ${provider.apiKeyEnv}.`);
      continue;
    }

    try {
      return await callProvider<T>(provider, prompt, options);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.label} failed: ${message}`);
      console.warn(`[ai] ${provider.label} failed for ${options.purpose}:`, err);
    }
  }

  throw new Error(`All AI providers failed. ${errors.join(" ")}`);
}

// ---- Seed clusters ----

interface ClusterDraft {
  label: string;
  summary: string;
}

const SEED_SCHEMA: JsonSchema = {
  name: "seed_clusters",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      clusters: {
        type: "array",
        minItems: 5,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            summary: { type: "string" },
          },
          required: ["label", "summary"],
        },
      },
    },
    required: ["clusters"],
  },
};

export async function seedClusters(
  topicId: string,
  question: string,
  context?: string | null
): Promise<ClusterDraft[]> {
  const prompt = `নিচের প্রশ্নের জন্য, ৫-৮টি স্বতন্ত্র মতামত ক্লাস্টার ড্রাফট করুন যা মানুষ ধারণ করতে পারে। প্রতিটি ক্লাস্টারে একটি ছোট লেবেল (≤৮০ অক্ষর) এবং যুক্তির এক বাক্যের সারাংশ থাকবে। বিস্তৃত অবস্থানের চেয়ে নির্দিষ্ট অবস্থান পছন্দ করুন। JSON ফেরত দিন: {"clusters":[{"label":"...","summary":"..."}]}। লেবেল ও সারাংশ অবশ্যই বাংলায় হবে।

Given the question below, draft 5-8 distinct opinion clusters someone might hold in Bangladesh's context. Each cluster: a short Bangla label (<=80 chars) plus a one-sentence Bangla summary. Prefer specific positions over broad ones. Return JSON in this exact shape: {"clusters":[{"label":"...","summary":"..."}]}.

প্রশ্ন / Question: ${question}${context ? `\n\nপ্রেক্ষাপট / Context: ${context}` : ""}`;

  const result = await callAiJson<{ clusters: ClusterDraft[] }>(prompt, {
    topicId,
    purpose: "seed",
    requestPayload: { question, context },
    schema: SEED_SCHEMA,
  });

  return result.clusters;
}

// ---- Cluster a take ----

interface ClusterResult {
  clusterId: string;
  matchScore: number;
  newClusterDraft?: { label: string; summary: string } | null;
}

const CLUSTER_SCHEMA: JsonSchema = {
  name: "cluster_take",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      clusterId: { type: "string" },
      matchScore: { type: "number", minimum: 0, maximum: 1 },
      newClusterDraft: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              summary: { type: "string" },
            },
            required: ["label", "summary"],
          },
          { type: "null" },
        ],
      },
    },
    required: ["clusterId", "matchScore", "newClusterDraft"],
  },
};

export async function clusterTake(
  takeId: string,
  transcript: string,
  clusters: Array<{ id: string; label: string; summary?: string | null }>
): Promise<ClusterResult> {
  const clusterList = clusters
    .map((c) => `- id: ${c.id}\n  লেবেল: ${c.label}\n  সারাংশ: ${c.summary ?? ""}`)
    .join("\n") || "(none yet)";

  const prompt = `আপনি একজন ব্যক্তির মতামত পাবেন বাংলা ট্রান্সক্রিপ্ট হিসেবে, এবং এই বিষয়ের জন্য বর্তমান মতামত ক্লাস্টারগুলো। সিদ্ধান্ত নিন কোন ক্লাস্টার তার মতের সাথে সবচেয়ে ভালো মেলে। যদি কোনো বর্তমান ক্লাস্টার না থাকে, অথবা তার মত সব ক্লাস্টার থেকে অর্থপূর্ণভাবে আলাদা হয় (similarity ০.৭ এর নিচে), একটি নতুন ক্লাস্টার প্রস্তাব করুন। বেংলিশ কোড-মিক্সিং স্বাভাবিক হিসেবে গণ্য করুন। JSON ফেরত দিন: {"clusterId":"...","matchScore":0.0,"newClusterDraft":{"label":"...","summary":"..."}}

ট্রান্সক্রিপ্ট / Transcript:
${transcript}

বর্তমান ক্লাস্টারগুলো / Current clusters:
${clusterList}

যদি নতুন ক্লাস্টার দরকার হয়, clusterId হিসেবে "new" দিন এবং newClusterDraft পূরণ করুন। যদি নতুন ক্লাস্টার দরকার না হয়, শুধু প্রদত্ত বর্তমান ক্লাস্টারের id ব্যবহার করুন এবং newClusterDraft null দিন।
If no current cluster exists, or a new cluster is needed, return clusterId as "new" and fill newClusterDraft. Otherwise use only one of the provided current cluster ids and return newClusterDraft as null.`;

  return callAiJson<ClusterResult>(prompt, {
    takeId,
    purpose: "cluster",
    requestPayload: { transcript, clusterCount: clusters.length },
    schema: CLUSTER_SCHEMA,
  });
}

// ---- Moderation ----

interface ModerationResult {
  is_safe: boolean;
  reason?: string | null;
}

const MODERATE_SCHEMA: JsonSchema = {
  name: "moderate_take",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      is_safe: { type: "boolean" },
      reason: { type: ["string", "null"] },
    },
    required: ["is_safe", "reason"],
  },
};

export async function moderateTake(
  takeId: string,
  transcript: string
): Promise<ModerationResult> {
  const prompt = `আপনি একটি বাংলা টেক্সট রিভিউ করছেন একটি পাবলিক ডিসকাশন প্ল্যাটফর্মের জন্য। নিচের মানদণ্ড দিয়ে বিচার করুন এবং JSON ফেরত দিন: {"is_safe":true,"reason":null}

You are reviewing a Bangla text for a public discussion platform in Bangladesh. Flag content that contains:
- বাংলা গালি বা হয়রানিমূলক ভাষা / Bangla slurs or harassing language
- ব্যক্তি বিশেষের প্রতি লক্ষ্যভিত্তিক ধর্মীয় বা রাজনৈতিক উস্কানি / Targeted religious or political incitement against individuals
- সহিংসতার আহ্বান / Calls for violence
- ব্যক্তিগত তথ্য প্রকাশ / Doxxing

Regular political opinions, criticism of policies, and strong (but non-harassing) language are SAFE. Err on the side of allowing speech.

টেক্সট / Text to review:
${transcript}`;

  return callAiJson<ModerationResult>(prompt, {
    takeId,
    purpose: "moderate",
    requestPayload: { transcriptLength: transcript.length },
    schema: MODERATE_SCHEMA,
    maxTokens: 500,
  });
}
