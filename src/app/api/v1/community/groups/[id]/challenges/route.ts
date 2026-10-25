import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { ApiError, body, forbidden, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { groupRole } from "@/lib/community";

/** Group challenges with shared progress. Weight loss, calorie minimums and fasting are never goals (PRD 10.3). */
export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const groupId = z.uuid().parse((await context.params).id);
  if (!(await groupRole(user.id, groupId))) throw forbidden("not_a_group_member");
  const rows = await db
    .select({
      challenge: schema.challenges,
      participants: sql<number>`(select count(distinct user_id)::int from challenge_progress p where p.challenge_id = ${schema.challenges.id})`,
      groupDays: sql<number>`(select count(*)::int from challenge_progress p where p.challenge_id = ${schema.challenges.id})`,
      myDays: sql<number>`(select count(*)::int from challenge_progress p where p.challenge_id = ${schema.challenges.id} and p.user_id = ${user.id})`,
    })
    .from(schema.challenges)
    .where(eq(schema.challenges.groupId, groupId));
  return ok({ challenges: rows.map((r) => ({ ...r.challenge, participants: r.participants, groupDays: r.groupDays, myDays: r.myDays })) });
});

export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const groupId = z.uuid().parse((await context.params).id);
  const role = await groupRole(user.id, groupId);
  if (role !== "admin" && role !== "moderator") throw forbidden();
  const input = await body(
    request,
    z.object({
      kind: z.enum(["veggies", "water", "protein", "breakfast", "steps", "custom"]),
      title: z.string().trim().min(3).max(80),
      targetDays: z.number().int().min(1).max(90),
      startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  );
  if (/(abnehm|lose weight|kilo|kg\b|kcal|kalorien|fast|fasten|hungern)/i.test(input.title)) throw new ApiError(422, "challenge_goal_not_allowed");
  if (input.endsOn < input.startsOn) throw new ApiError(422, "invalid_dates");
  const [challenge] = await db.insert(schema.challenges).values({ ...input, groupId, createdBy: user.id }).returning();
  return ok(challenge, 201);
});
