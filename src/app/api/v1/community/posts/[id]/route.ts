import { z } from "zod";
import { noContent, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deletePost, visiblePost } from "@/lib/community";

export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const { id } = await context.params;
  const post = await visiblePost(user.id, z.uuid().parse(id));
  return ok({ id: post.id, kind: post.kind, body: post.body, attachment: post.attachment, status: post.status, createdAt: post.createdAt, reactionCount: post.reactionCount, commentCount: post.commentCount });
});

export const DELETE = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const { id } = await context.params;
  await deletePost(user.id, z.uuid().parse(id));
  return noContent();
});
