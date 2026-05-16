import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "voice-takes";

export async function getUploadUrl(
  takeId: string
): Promise<{ uploadUrl: string; publicPath: string }> {
  const path = `takes/${takeId}.webm`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error) throw new Error("Failed to create upload URL: " + error.message);

  return {
    uploadUrl: data.signedUrl,
    publicPath: path,
  };
}

export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);

  if (error) throw new Error("Failed to get signed URL: " + error.message);
  return data.signedUrl;
}
