import { z } from "zod";
import { body, forbidden, ok, route } from "@/lib/api";
import { devLoginAllowed, startSession } from "@/lib/auth";
import { findOrCreateUser } from "@/lib/users";

/** Development only: signs in a test account without Apple. Disabled in production. */
export const POST = route(async (request) => {
  if (!devLoginAllowed()) throw forbidden("dev_login_disabled");
  const { name } = await body(request, z.object({ name: z.string().regex(/^[a-z0-9_-]{2,32}$/) }));
  const { user, isNew } = await findOrCreateUser(`dev:${name}`, undefined, name);
  const tokens = await startSession(user.id, { name: "dev" });
  return ok({ user: { id: user.id, isNew, plan: user.plan }, ...tokens });
});
