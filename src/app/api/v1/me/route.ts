import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { currentGoal, deleteAccount, latestConsents } from "@/lib/account";

export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
  const [community] = await db.select().from(schema.communityProfiles).where(eq(schema.communityProfiles.userId, user.id));
  return ok({
    id: user.id,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt,
    createdAt: user.createdAt,
    profile: profile ?? null,
    goal: await currentGoal(user.id),
    consents: await latestConsents(user.id),
    community: community ? { handle: community.handle, visibility: community.visibility } : null,
  });
});

/** Account deletion in the app (PRD PRV-04). */
export const DELETE = route(async (request) => {
  const { user } = await requireUser(request);
  return ok({ deleted: true, ...(await deleteAccount(user.id)) });
});
