import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * File storage. Production uses the private Railway bucket (S3 compatible);
 * development falls back to ./storage on disk. Nothing here is public: files are
 * served through the API or through short-lived signed links.
 */
const bucket = process.env.BUCKET ?? process.env.S3_BUCKET;
const s3 = bucket
  ? new S3Client({
      region: process.env.REGION ?? process.env.AWS_REGION ?? "auto",
      endpoint: process.env.ENDPOINT ?? process.env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    })
  : null;
const localRoot = path.join(process.cwd(), "storage");

function localPath(key: string): string {
  const resolved = path.resolve(localRoot, key);
  if (!resolved.startsWith(localRoot + path.sep)) throw new Error("invalid storage key");
  return resolved;
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function getObject(key: string): Promise<Uint8Array | null> {
  try {
    if (s3) {
      const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return result.Body ? await result.Body.transformToByteArray() : null;
    }
    return new Uint8Array(await readFile(localPath(key)));
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (s3) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
    return;
  }
  await rm(localPath(key), { force: true });
}

/** Direct upload from the app (PRD 11.4): a signed PUT link valid for a few minutes. */
export async function signedUploadURL(key: string, contentType: string): Promise<string | null> {
  if (!s3) return null;
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 300 });
}

export async function signedDownloadURL(key: string): Promise<string | null> {
  if (!s3) return null;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
}

export const usesBucket = () => Boolean(s3);

/** Accepts PNG, JPEG and WebP only, checked by content, not by file name. */
export function detectImageType(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}
