import { z } from "zod";
import { body, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { revokeSessions, sessionsOf } from "@/lib/account";

export const GET = route(async (request) => {
  const { user, sessionId } = await requireUser(request);
  const sessions = await sessionsOf(user.id);
  return ok({ sessions: sessions.map((s) => ({ ...s, current: s.id === sessionId })) });
});

/** Signs out other devices. */
export const DELETE = route(async (request) => {
  const { user } = await requireUser(request);
  const { ids } = await body(request, z.object({ ids: z.array(z.uuid()).max(50) }));
  await revokeSessions(user.id, ids);
  return ok({ revoked: ids.length });
});
