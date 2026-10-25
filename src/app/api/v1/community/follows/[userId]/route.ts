import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { noContent, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { follow } from "@/lib/community";

/** Follow; private profiles get a request instead (COM-05). */
export const POST = route(async (request, context: { params: Promise<{ userId: string }> }) => {
  const { user } = await requireUser(request);
  const { userId } = await context.params;
  return ok(await follow(user.id, z.uuid().parse(userId)));
});

export const DELETE = route(async (request, context: { params: Promise<{ userId: string }> }) => {
  const { user } = await requireUser(request);
  const { userId } = await context.params;
  await db.delete(schema.follows).where(and(eq(schema.follows.followerId, user.id), eq(schema.follows.followeeId, z.uuid().parse(userId))));
  return noContent();
});
