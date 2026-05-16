import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.B2_BUCKET!;
const REGION = process.env.B2_REGION ?? "us-east-005";
const ENDPOINT = `https://${process.env.B2_ENDPOINT}`;

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

export async function getSignedDownloadUrl(path: string): Promise<string> {
  const client = getClient();

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: path,
  });

  return getSignedUrl(client, command, { expiresIn: 3600 });
}
