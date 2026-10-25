import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { ApiError, body, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { currentGoal, validateGoal } from "@/lib/account";

const input = z.object({
  id: z.uuid(),
  kind: z.enum(["lose", "maintain", "gain", "muscle", "custom"]),
  targetWeightKg: z.number().min(30).max(300).nullable().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pace: z.enum(["gentle", "moderate", "ambitious"]).nullable().optional(),
  kcalTarget: z.number().int().min(800).max(6000),
  proteinG: z.number().int().min(0).max(600).nullable().optional(),
  carbsG: z.number().int().min(0).max(1000).nullable().optional(),
  fatG: z.number().int().min(0).max(400).nullable().optional(),
  waterMl: z.number().int().min(500).max(8000).nullable().optional(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  return ok({ goal: await currentGoal(user.id) });
});

/** Goals are versioned by validity date; the server enforces the safety limits from PRD 17.4. */
export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  const goal = await body(request, input);
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
  const problems = await validateGoal(goal, { sexForCalc: profile?.sexForCalc ?? null, heightCm: profile?.heightCm ?? null });
  if (problems.length) throw new ApiError(422, "goal_outside_safety_limits", problems.join(","));
  const [saved] = await db
    .insert(schema.goals)
    .values({ ...goal, userId: user.id })
    .onConflictDoUpdate({ target: schema.goals.id, set: { ...goal, userId: user.id } })
    .returning();
  return ok(saved, 201);
});
