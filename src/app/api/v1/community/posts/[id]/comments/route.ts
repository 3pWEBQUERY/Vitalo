import { z } from "zod";
import { body, ok, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { addComment, comments } from "@/lib/community";

export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const { id } = await context.params;
  return ok({ comments: await comments(user.id, z.uuid().parse(id)) });
});

export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  rateLimit(`comment:${user.id}`, 60, 60 * 60_000);
  const { id } = await context.params;
  const input = await body(request, z.object({ body: z.string().trim().min(1).max(1000), parentId: z.uuid().nullable().optional() }));
  const { comment, showSupportResources } = await addComment(user.id, z.uuid().parse(id), input.body, input.parentId);
  return ok({ id: comment.id, status: comment.status, showSupportResources }, 201);
});
