import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { body, clientIp, ok, rateLimit, route } from "@/lib/api";
import { exchangeAppleCode, requireUser, startSession, verifyAppleIdentity } from "@/lib/auth";
import { findOrCreateUser } from "@/lib/users";

const input = z.object({
  identityToken: z.string().min(20),
  authorizationCode: z.string().optional(),
  nonce: z.string().optional(),
  displayName: z.string().max(80).optional(),
  deviceName: z.string().max(80).optional(),
  appVersion: z.string().max(20).optional(),
});

async function signedInUser(request: NextRequest) {
  if (!request.headers.get("authorization")) return null;
  try {
    return (await requireUser(request)).user;
  } catch {
    return null;
  }
}

/**
 * Sign in with Apple. Signed in already (device account) and the Apple ID is new: the Apple ID
 * is linked to the current account and nothing changes for the person. If the Apple ID already
 * has an account, that account is opened instead (`switched: true`), e.g. on a new iPhone.
 */
export const POST = route(async (request) => {
  rateLimit(`auth:${clientIp(request)}`, 20, 60_000);
  const data = await body(request, input);
  const apple = await verifyAppleIdentity(data.identityToken, data.nonce);
  const current = await signedInUser(request);
  const [owner] = await db.select().from(schema.users).where(eq(schema.users.appleSub, apple.sub)).limit(1);

  let user;
  let isNew = false;
  let switched = false;
  if (current && (!owner || owner.deletedAt) && !current.appleSub) {
    [user] = await db.update(schema.users).set({ appleSub: apple.sub, email: current.email ?? apple.email ?? null }).where(eq(schema.users.id, current.id)).returning();
  } else {
    ({ user, isNew } = await findOrCreateUser(apple.sub, apple.email, data.displayName));
    switched = Boolean(current && current.id !== user.id);
  }
  if (data.authorizationCode) {
    const appleRefresh = await exchangeAppleCode(data.authorizationCode);
    if (appleRefresh) await db.update(schema.users).set({ appleRefreshToken: appleRefresh }).where(eq(schema.users.id, user.id));
  }
  const tokens = await startSession(user.id, { name: data.deviceName, appVersion: data.appVersion });
  return ok({ user: { id: user.id, isNew, plan: user.plan, appleLinked: true }, switched, ...tokens });
});
