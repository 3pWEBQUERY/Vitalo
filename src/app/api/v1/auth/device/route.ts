import { z } from "zod";
import { body, clientIp, ok, rateLimit, route } from "@/lib/api";
import { hashToken, startSession } from "@/lib/auth";
import { findOrCreateDeviceUser } from "@/lib/users";

const input = z.object({
  // 32 random bytes from the iPhone's Keychain, base64url encoded.
  secret: z.string().regex(/^[A-Za-z0-9_-]{43,86}$/),
  deviceName: z.string().max(80).optional(),
  appVersion: z.string().max(20).optional(),
});

/**
 * Account without an Apple ID: the app creates a secret once and keeps it in the Keychain,
 * so the account survives reinstalls on the same iPhone. Sign in with Apple links it later.
 */
export const POST = route(async (request) => {
  rateLimit(`auth-device:${clientIp(request)}`, 20, 60_000);
  const data = await body(request, input);
  const { user, isNew } = await findOrCreateDeviceUser(hashToken(`device:${data.secret}`));
  const tokens = await startSession(user.id, { name: data.deviceName, appVersion: data.appVersion });
  return ok({ user: { id: user.id, isNew, plan: user.plan, appleLinked: Boolean(user.appleSub) }, ...tokens });
});
