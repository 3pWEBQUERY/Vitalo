import { and, gte, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

/** Challenges run by Vitalo plus those of the person's groups, with their own progress. */
export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
  const rows = await db
    .select({
      challenge: schema.challenges,
      participants: sql<number>`(select count(distinct user_id)::int from challenge_progress p where p.challenge_id = ${schema.challenges.id})`,
      myDays: sql<number>`(select count(*)::int from challenge_progress p where p.challenge_id = ${schema.challenges.id} and p.user_id = ${user.id})`,
    })
    .from(schema.challenges)
    .where(
      and(
        gte(schema.challenges.endsOn, today),
        or(
          isNull(schema.challenges.groupId),
          sql`${schema.challenges.groupId} in (select group_id from group_members where user_id = ${user.id} and status = 'active')`,
        ),
      ),
    )
    .orderBy(schema.challenges.startsOn);
  return ok({
    challenges: rows.map((r) => ({
      id: r.challenge.id,
      title: r.challenge.title,
      description: r.challenge.description,
      kind: r.challenge.kind,
      targetDays: r.challenge.targetDays,
      startsOn: r.challenge.startsOn,
      endsOn: r.challenge.endsOn,
      groupId: r.challenge.groupId,
      participants: r.participants,
      myDays: r.myDays,
    })),
  });
});
