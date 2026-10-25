import { z } from "zod";
import { body, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { coachLog, deleteCoachLog } from "@/lib/coach";

/** All observations and suggestions of the last 90 days, viewable and deletable (CCH-07). */
export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  return ok({ entries: await coachLog(user.id) });
});

export const DELETE = route(async (request) => {
  const { user } = await requireUser(request);
  const { ids } = await body(request, z.object({ ids: z.array(z.uuid()).max(200).optional() }));
  await deleteCoachLog(user.id, ids);
  return ok({ deleted: true });
});
