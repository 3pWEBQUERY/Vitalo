import { z } from "zod";
import { body, ok, route } from "@/lib/api";
import { handleNotification } from "@/lib/appstore";

/** App Store Server Notifications v2 endpoint (set in App Store Connect). Always 200 once verified. */
export const POST = route(async (request) => {
  const { signedPayload } = await body(request, z.object({ signedPayload: z.string().min(100).max(100_000) }));
  return ok(await handleNotification(signedPayload));
});
