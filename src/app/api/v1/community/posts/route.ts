import { z } from "zod";
import { body, ok, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createPost } from "@/lib/community";

const input = z.object({
  kind: z.enum(["text", "photo", "meal", "progress", "milestone", "recipe"]),
  body: z.string().trim().max(2000).nullable().optional(),
  visibility: z.enum(["followers", "public"]).default("followers"),
  groupId: z.uuid().nullable().optional(),
  mediaIds: z.array(z.uuid()).max(6).default([]),
  // Progress cards carry changes or percentages; absolute values only when the person chose to share them.
  attachment: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).nullable().optional(),
}).refine((p) => (p.body?.length ?? 0) > 0 || p.mediaIds.length > 0 || p.attachment, { message: "empty_post" });

export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  rateLimit(`post:${user.id}`, 20, 60 * 60_000);
  const { post, showSupportResources } = await createPost(user.id, await body(request, input));
  return ok({ id: post.id, status: post.status, showSupportResources }, 201);
});
