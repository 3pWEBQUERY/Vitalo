import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { body, clientIp, ok, rateLimit, route } from "@/lib/api";
import { exchangeAppleCode, startSession, verifyAppleIdentity } from "@/lib/auth";
import { findOrCreateUser } from "@/lib/users";

const input = z.object({
  identityToken: z.string().min(20),
  authorizationCode: z.string().optional(),
  nonce: z.string().optional(),
  displayName: z.string().max(80).optional(),
  deviceName: z.string().max(80).optional(),
  appVersion: z.string().max(20).optional(),
});

/** Sign in with Apple: verifies Apple's token and opens a device session. */
export const POST = route(async (request) => {
  rateLimit(`auth:${clientIp(request)}`, 20, 60_000);
  const data = await body(request, input);
  const apple = await verifyAppleIdentity(data.identityToken, data.nonce);
  const { user, isNew } = await findOrCreateUser(apple.sub, apple.email, data.displayName);
  if (data.authorizationCode) {
    const appleRefresh = await exchangeAppleCode(data.authorizationCode);
    if (appleRefresh) await db.update(schema.users).set({ appleRefreshToken: appleRefresh }).where(eq(schema.users.id, user.id));
  }
  const tokens = await startSession(user.id, { name: data.deviceName, appVersion: data.appVersion });
  return ok({ user: { id: user.id, isNew, plan: user.plan }, ...tokens });
});
