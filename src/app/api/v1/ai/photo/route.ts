import { badRequest, ok, rateLimit, route } from "@/lib/api";
import { analyzePhoto } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { detectImageType } from "@/lib/storage";

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Meal photo recognition. Accepts the image as the raw body (image/jpeg, png or webp) or as
 * multipart field "image". The photo is analysed in memory and never stored (PRD 15.4).
 */
export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  rateLimit(`ai:${user.id}`, 10, 60_000);
  let bytes: Uint8Array;
  if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const file = (await request.formData()).get("image");
    if (!file || typeof file === "string") throw badRequest("image_missing");
    bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    bytes = new Uint8Array(await request.arrayBuffer());
  }
  if (bytes.byteLength === 0) throw badRequest("image_missing");
  if (bytes.byteLength > MAX_BYTES) throw badRequest("image_too_large", "Resize to at most 1280 px on the long edge.");
  const type = detectImageType(bytes);
  if (!type) throw badRequest("unsupported_image");
  return ok(await analyzePhoto(user, bytes, type));
});
