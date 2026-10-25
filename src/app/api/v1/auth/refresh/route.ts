import { z } from "zod";
import { body, clientIp, ok, rateLimit, route } from "@/lib/api";
import { refreshSession } from "@/lib/auth";

export const POST = route(async (request) => {
  rateLimit(`refresh:${clientIp(request)}`, 60, 60_000);
  const { refreshToken } = await body(request, z.object({ refreshToken: z.string().min(20) }));
  return ok(await refreshSession(refreshToken));
});
