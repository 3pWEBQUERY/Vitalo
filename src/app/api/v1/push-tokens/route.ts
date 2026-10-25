import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { body, noContent, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const token = z.string().regex(/^[0-9a-f]{64,200}$/i);

export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  const input = await body(request, z.object({ token, environment: z.enum(["production", "sandbox"]).default("production"), locale: z.string().max(10).optional() }));
  await db
    .insert(schema.pushTokens)
    .values({ token: input.token, userId: user.id, environment: input.environment, locale: input.locale ?? null })
    .onConflictDoUpdate({ target: schema.pushTokens.token, set: { userId: user.id, environment: input.environment, locale: input.locale ?? null, updatedAt: new Date() } });
  return ok({ registered: true }, 201);
});

export const DELETE = route(async (request) => {
  const { user } = await requireUser(request);
  const input = await body(request, z.object({ token }));
  await db.delete(schema.pushTokens).where(and(eq(schema.pushTokens.token, input.token), eq(schema.pushTokens.userId, user.id)));
  return noContent();
});
