import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { noContent, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { joinGroup } from "@/lib/community";

/** Join: public groups at once, private ones by request, invite-only with an invitation. */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  return ok(await joinGroup(user.id, z.uuid().parse((await context.params).id)));
});

export const DELETE = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const id = z.uuid().parse((await context.params).id);
  await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, id), eq(schema.groupMembers.userId, user.id)));
  return noContent();
});
