import { and, isNotNull, lt, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { ok, route } from "@/lib/api";
import { cleanupExpiredHolds } from "@/lib/community";
import { requireJobSecret } from "@/lib/jobs";

/**
 * Daily housekeeping: held posts without a decision after 30 days, ended sign-ins, and
 * AI cost records older than 13 months (they hold no content, only counts and costs).
 */
export const POST = route(async (request) => {
  requireJobSecret(request);
  const now = new Date();
  await cleanupExpiredHolds();
  const devices = await db
    .delete(schema.deviceSessions)
    .where(or(lt(schema.deviceSessions.expiresAt, now), and(isNotNull(schema.deviceSessions.revokedAt), lt(schema.deviceSessions.revokedAt, new Date(now.getTime() - 30 * 86400_000)))))
    .returning({ id: schema.deviceSessions.id });
  const admins = await db.delete(schema.adminSessions).where(lt(schema.adminSessions.expiresAt, now)).returning({ id: schema.adminSessions.id });
  const ai = await db.delete(schema.aiRequests).where(lt(schema.aiRequests.createdAt, new Date(now.getTime() - 400 * 86400_000))).returning({ id: schema.aiRequests.id });
  return ok({ deviceSessions: devices.length, adminSessions: admins.length, aiRequests: ai.length });
});
