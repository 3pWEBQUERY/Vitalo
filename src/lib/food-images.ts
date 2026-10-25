import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { MAX_IMAGE_BYTES, MediaError, removeMedia, saveImage } from "./media";
import { detectImageType } from "./storage";

/** Turns a stored image path into an absolute URL the app can load. */
export function publicImageUrl(url: string | null): string | null {
  if (!url || !url.startsWith("/")) return url;
  const base = (process.env.PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${url}`;
}

/**
 * Stores an uploaded product photo in the bucket: re-encoded as WebP (at most 1200 px,
 * without camera metadata) and linked to the food. A previous upload is removed.
 */
export async function replaceFoodImage(foodId: string, upload: Uint8Array | null, remove: boolean): Promise<{ imageUrl: string | null; imageMediaId: string | null } | null> {
  if (!upload && !remove) return null;
  const [food] = await db.select({ imageMediaId: schema.foods.imageMediaId, imageUrl: schema.foods.imageUrl }).from(schema.foods).where(eq(schema.foods.id, foodId));
  let next: { imageUrl: string | null; imageMediaId: string | null } = { imageUrl: null, imageMediaId: null };
  if (upload) {
    if (upload.byteLength > MAX_IMAGE_BYTES) throw new MediaError("Bilder dürfen höchstens 5 MB gross sein.");
    if (!detectImageType(upload)) throw new MediaError("Bitte ein Bild im Format PNG, JPEG oder WebP wählen.");
    const webp = await sharp(upload).rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    const media = await saveImage(new Uint8Array(webp), "food_image");
    next = { imageMediaId: media.id, imageUrl: `/api/v1/foods/${foodId}/image?v=${media.id.slice(0, 8)}` };
  }
  await db.update(schema.foods).set({ ...next, updatedAt: new Date() }).where(eq(schema.foods.id, foodId));
  if (food?.imageMediaId) await removeMedia(food.imageMediaId);
  return next;
}
