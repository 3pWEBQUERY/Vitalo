import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { body, noContent, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

/** Block (both see nothing of each other, follows end) or mute (MOD-02). */
export const POST = route(async (request, context: { params: Promise<{ userId: string }> }) => {
  const { user } = await requireUser(request);
  const target = z.uuid().parse((await context.params).userId);
  const { kind } = await body(request, z.object({ kind: z.enum(["block", "mute"]).default("block") }));
  await db
    .insert(schema.blocks)
    .values({ blockerId: user.id, blockedId: target, kind })
    .onConflictDoUpdate({ target: [schema.blocks.blockerId, schema.blocks.blockedId], set: { kind } });
  if (kind === "block") {
    await db
      .delete(schema.follows)
      .where(
        or(
          and(eq(schema.follows.followerId, user.id), eq(schema.follows.followeeId, target)),
          and(eq(schema.follows.followerId, target), eq(schema.follows.followeeId, user.id)),
        ),
      );
  }
  return noContent();
});

export const DELETE = route(async (request, context: { params: Promise<{ userId: string }> }) => {
  const { user } = await requireUser(request);
  const target = z.uuid().parse((await context.params).userId);
  await db.delete(schema.blocks).where(and(eq(schema.blocks.blockerId, user.id), eq(schema.blocks.blockedId, target)));
  return noContent();
});
