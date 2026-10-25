import { z } from "zod";
import { body, ok, rateLimit, route } from "@/lib/api";
import { verifyPurchase } from "@/lib/appstore";
import { requireUser } from "@/lib/auth";

/** The app sends Transaction.jwsRepresentation after a purchase or restore. */
export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  rateLimit(`iap:${user.id}`, 30, 60_000);
  const { signedTransaction } = await body(request, z.object({ signedTransaction: z.string().min(100).max(20_000) }));
  return ok(await verifyPurchase(user.id, signedTransaction));
});
