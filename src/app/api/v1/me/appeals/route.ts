import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { body, notFound, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  const sanctions = await db.select().from(schema.userSanctions).where(eq(schema.userSanctions.userId, user.id)).orderBy(desc(schema.userSanctions.createdAt));
  const appeals = await db.select().from(schema.appeals).where(eq(schema.appeals.userId, user.id));
  return ok({ sanctions, appeals });
});

/** Appeal against a warning, suspension or ban (MOD-06). */
export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  const input = await body(request, z.object({ sanctionId: z.uuid(), body: z.string().trim().min(10).max(2000) }));
  const [sanction] = await db
    .select()
    .from(schema.userSanctions)
    .where(and(eq(schema.userSanctions.id, input.sanctionId), eq(schema.userSanctions.userId, user.id)));
  if (!sanction) throw notFound();
  const [appeal] = await db.insert(schema.appeals).values({ userId: user.id, sanctionId: sanction.id, body: input.body }).returning();
  return ok(appeal, 201);
});
