import { z } from "zod";
import { ok, query, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { pull } from "@/lib/sync";

export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  const { cursor } = query(request, z.object({ cursor: z.iso.datetime({ offset: true }).optional() }));
  return ok(await pull(user.id, cursor ? new Date(cursor) : null));
});
