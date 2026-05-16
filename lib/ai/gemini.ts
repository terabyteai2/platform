import { db } from "@/lib/db";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function callGemini<T>(
  prompt: string,
  schema: object,
  options: {
    takeId?: string;
    topicId?: string;
    purpose: "seed" | "cluster" | "moderate";
    requestPayload?: object;
  }
): Promise<T> {
  const t0 = Date.now();
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  };

  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const latency = Date.now() - t0;
  const data = await res.json();

  await db.aiCall.create({
    data: {
      takeId: options.takeId ?? null,
      topicId: options.topicId ?? null,
      provider: "gemini_flash",
      purpose: options.purpose,
      latencyMs: latency,
      success: res.ok,
      errorReason: res.ok ? null : JSON.stringify(data?.error),
      requestPayload: options.requestPayload ?? { prompt },
      responsePayload: data,
    },
  });

  if (!res.ok) throw new Error("Gemini error: " + JSON.stringify(data?.error));

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return JSON.parse(text) as T;
}

// ---- Seed clusters ----

interface ClusterDraft {
  label: string;
  summary: string;
}

const SEED_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      label: { type: "string" },
      summary: { type: "string" },
    },
    required: ["label", "summary"],
  },
};

export async function seedClusters(
  topicId: string,
  question: string,
  context?: string | null
): Promise<ClusterDraft[]> {
  const prompt = `নিচের প্রশ্নের জন্য, ৫-৮টি স্বতন্ত্র মতামত ক্লাস্টার ড্রাফট করুন যা মানুষ ধারণ করতে পারে। প্রতিটি ক্লাস্টারে একটি ছোট লেবেল (≤৮০ অক্ষর) এবং যুক্তির এক বাক্যের সারাংশ থাকবে। বিস্তৃত অবস্থানের চেয়ে নির্দিষ্ট অবস্থান পছন্দ করুন। JSON ফেরত দিন: [{label, summary}]। লেবেল ও সারাংশ অবশ্যই বাংলায় হবে।

Given the question below, draft 5–8 distinct opinion clusters someone might hold in Bangladesh's context. Each cluster: a short Bangla label (≤80 chars) plus a one-sentence Bangla summary. Prefer specific positions over broad ones. Return JSON: [{label, summary}].

প্রশ্ন / Question: ${question}${context ? `\n\nপ্রেক্ষাপট / Context: ${context}` : ""}`;

  return callGemini<ClusterDraft[]>(prompt, SEED_SCHEMA, {
    topicId,
    purpose: "seed",
    requestPayload: { question, context },
  });
}

// ---- Cluster a take ----

interface ClusterResult {
  clusterId: string;
  matchScore: number;
  newClusterDraft?: { label: string; summary: string } | null;
}

const CLUSTER_SCHEMA = {
  type: "object",
  properties: {
    clusterId: { type: "string" },
    matchScore: { type: "number" },
    newClusterDraft: {
      type: "object",
      nullable: true,
      properties: {
        label: { type: "string" },
        summary: { type: "string" },
      },
    },
  },
  required: ["clusterId", "matchScore"],
};

export async function clusterTake(
  takeId: string,
  transcript: string,
  clusters: Array<{ id: string; label: string; summary?: string | null }>
): Promise<ClusterResult> {
  const clusterList = clusters
    .map((c) => `- id: ${c.id}\n  লেবেল: ${c.label}\n  সারাংশ: ${c.summary ?? ""}`)
    .join("\n");

  const prompt = `আপনি একজন ব্যক্তির মতামত পাবেন বাংলা ট্রান্সক্রিপ্ট হিসেবে, এবং এই বিষয়ের জন্য বর্তমান মতামত ক্লাস্টারগুলো। সিদ্ধান্ত নিন কোন ক্লাস্টার তার মতের সাথে সবচেয়ে ভালো মেলে। যদি তার মত সব ক্লাস্টার থেকে অর্থপূর্ণভাবে আলাদা হয় (similarity ০.৭ এর নিচে), একটি নতুন ক্লাস্টার প্রস্তাব করুন। বেংলিশ কোড-মিক্সিং স্বাভাবিক হিসেবে গণ্য করুন। JSON ফেরত দিন: { clusterId, matchScore, newClusterDraft: { label, summary } | null }

ট্রান্সক্রিপ্ট / Transcript:
${transcript}

বর্তমান ক্লাস্টারগুলো / Current clusters:
${clusterList}

যদি নতুন ক্লাস্টার দরকার হয়, clusterId হিসেবে "new" দিন।
If a new cluster is needed, return clusterId as "new".`;

  return callGemini<ClusterResult>(prompt, CLUSTER_SCHEMA, {
    takeId,
    purpose: "cluster",
    requestPayload: { transcript, clusterCount: clusters.length },
  });
}

// ---- Moderation ----

interface ModerationResult {
  is_safe: boolean;
  reason?: string;
}

const MODERATE_SCHEMA = {
  type: "object",
  properties: {
    is_safe: { type: "boolean" },
    reason: { type: "string" },
  },
  required: ["is_safe"],
};

export async function moderateTake(
  takeId: string,
  transcript: string
): Promise<ModerationResult> {
  const prompt = `আপনি একটি বাংলা টেক্সট রিভিউ করছেন একটি পাবলিক ডিসকাশন প্ল্যাটফর্মের জন্য। নিচের মানদণ্ড দিয়ে বিচার করুন এবং JSON ফেরত দিন: {is_safe: boolean, reason?: string}

You are reviewing a Bangla text for a public discussion platform in Bangladesh. Flag content that contains:
- বাংলা গালি বা হয়রানিমূলক ভাষা / Bangla slurs or harassing language
- ব্যক্তি বিশেষের প্রতি লক্ষ্যভিত্তিক ধর্মীয় বা রাজনৈতিক উস্কানি / Targeted religious or political incitement against individuals
- সহিংসতার আহ্বান / Calls for violence
- ব্যক্তিগত তথ্য প্রকাশ / Doxxing

Regular political opinions, criticism of policies, and strong (but non-harassing) language are SAFE. Err on the side of allowing speech.

টেক্সট / Text to review:
${transcript}`;

  return callGemini<ModerationResult>(prompt, MODERATE_SCHEMA, {
    takeId,
    purpose: "moderate",
    requestPayload: { transcriptLength: transcript.length },
  });
}
