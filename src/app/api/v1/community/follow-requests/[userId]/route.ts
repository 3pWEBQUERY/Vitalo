import { z } from "zod";
import { body, noContent, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { answerFollowRequest } from "@/lib/community";

export const POST = route(async (request, context: { params: Promise<{ userId: string }> }) => {
  const { user } = await requireUser(request);
  const { userId } = await context.params;
  const { accept } = await body(request, z.object({ accept: z.boolean() }));
  await answerFollowRequest(user.id, z.uuid().parse(userId), accept);
  return noContent();
});
