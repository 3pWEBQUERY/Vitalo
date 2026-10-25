import { z } from "zod";
import { badRequest, ok, query, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { processUpload } from "@/lib/community";

/** Image upload (raw body or multipart "image"). Location data is removed before storing. */
export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  rateLimit(`upload:${user.id}`, 60, 60 * 60_000);
  const { purpose } = query(request, z.object({ purpose: z.enum(["post", "progress_photo", "label"]).default("post") }));
  let bytes: Uint8Array;
  if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const file = (await request.formData()).get("image");
    if (!file || typeof file === "string") throw badRequest("image_missing");
    bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    bytes = new Uint8Array(await request.arrayBuffer());
  }
  if (!bytes.byteLength) throw badRequest("image_missing");
  const media = await processUpload(bytes, user.id, purpose);
  return ok({ id: media.id, url: `/api/v1/media/${media.id}` }, 201);
});
