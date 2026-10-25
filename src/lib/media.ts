import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Media } from "@/db/schema";
import { deleteObject, detectImageType, getObject, putObject } from "./storage";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export class MediaError extends Error {}

type Purpose = Media["purpose"];

/** Stores an uploaded image after checking its real type and size. */
export async function saveImage(bytes: Uint8Array, purpose: Purpose, ownerUserId?: string): Promise<Media> {
  if (bytes.byteLength === 0) throw new MediaError("Die Datei ist leer.");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new MediaError("Bilder dürfen höchstens 5 MB gross sein.");
  const type = detectImageType(bytes);
  if (!type) throw new MediaError("Nur PNG, JPEG oder WebP.");
  const extension = type.split("/")[1];
  const key = `${purpose}/${randomUUID()}.${extension}`;
  await putObject(key, bytes, type);
  const [media] = await db
    .insert(schema.media)
    .values({ storageKey: key, contentType: type, byteSize: bytes.byteLength, purpose, ownerUserId: ownerUserId ?? null })
    .returning();
  return media;
}

export async function readMedia(id: string): Promise<{ media: Media; bytes: Uint8Array } | null> {
  const [media] = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
  if (!media) return null;
  const bytes = await getObject(media.storageKey);
  return bytes ? { media, bytes } : null;
}

export async function removeMedia(id: string): Promise<void> {
  const [media] = await db.delete(schema.media).where(eq(schema.media.id, id)).returning();
  if (media) await deleteObject(media.storageKey);
}

/** Reads an optional file field from a form; returns null when nothing was chosen. */
export async function formImage(value: FormDataEntryValue | null): Promise<Uint8Array | null> {
  if (!value || typeof value === "string" || value.size === 0) return null;
  return new Uint8Array(await value.arrayBuffer());
}
